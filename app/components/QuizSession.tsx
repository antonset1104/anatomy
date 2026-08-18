"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Flame, X } from "lucide-react";
import type { Hotspot, Organ } from "../i18n/merge";
import { format, type UiDictionary } from "../i18n/types";
import { buildQuestions, type QuizMode, type QuizQuestion, type QuizScope } from "../lib/quiz";
import type { OrganId } from "../lib/anatomy-data";
import { Modal, Segmented } from "./primitives";

export type QuizConfig = { mode: QuizMode; scope: QuizScope };

/** Correct answers hold for a beat; a miss holds longer because it carries more
 *  to read. */
const HOLD_CORRECT_MS = 1150;
const HOLD_WRONG_MS = 2400;

export function QuizLauncher({
  t,
  organ,
  onStart,
  onClose,
}: {
  t: UiDictionary;
  organ: Organ;
  onStart: (config: QuizConfig) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<QuizMode>("label");
  const [scope, setScope] = useState<QuizScope>("organ");

  const modes: { id: QuizMode; title: string; body: string }[] = [
    { id: "label", title: t.quiz.modeLabel, body: t.quiz.modeLabelBody },
    { id: "choice", title: t.quiz.modeChoice, body: t.quiz.modeChoiceBody },
    { id: "match", title: t.quiz.modeMatch, body: t.quiz.modeMatchBody },
  ];

  return (
    <Modal title={t.quiz.chooseMode} subtitle={organ.name} closeLabel={t.common.close} onClose={onClose} size="md">
      <div className="quiz-modes">
        {modes.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`quiz-mode ${mode === option.id ? "active" : ""}`}
            aria-pressed={mode === option.id}
            onClick={() => setMode(option.id)}
          >
            <b>{option.title}</b>
            <small>{option.body}</small>
          </button>
        ))}
      </div>

      {/* Label mode is answered by clicking this specimen, so widening the scope
          would ask about structures that are not on screen. */}
      {mode !== "label" && (
        <div className="field-row">
          <span className="panel-label">{t.quiz.scope}</span>
          <Segmented
            label={t.quiz.scope}
            value={scope}
            onChange={setScope}
            options={[
              { value: "organ", label: t.quiz.scopeOrgan },
              { value: "all", label: t.quiz.scopeAll },
            ]}
          />
        </div>
      )}

      <button type="button" className="button-primary wide" onClick={() => onStart({ mode, scope: mode === "label" ? "organ" : scope })}>
        {t.quiz.begin}
      </button>
    </Modal>
  );
}

type SessionProps = {
  t: UiDictionary;
  config: QuizConfig;
  organ: Organ;
  organs: Organ[];
  /** Registered by the viewer so a dot press reaches the current question. */
  pickRef: React.MutableRefObject<(hotspot: Hotspot) => void>;
  flash: (id: string, correct: boolean) => void;
  screenY: (id: string) => number | null;
  onLearned: (organId: OrganId, hotspotId: string) => void;
  onFinish: (score: number, total: number) => void;
  onExit: () => void;
};

export function QuizSession({
  t, config, organ, organs, pickRef, flash, screenY, onLearned, onFinish, onExit,
}: SessionProps) {
  const [seed, setSeed] = useState(0);
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [missed, setMissed] = useState<QuizQuestion[]>([]);
  const [answer, setAnswer] = useState<
    { correct: boolean; pickedLabel: string; targetLabel: string; atTop: boolean } | null
  >(null);
  const reported = useRef(false);

  const questions = useMemo(
    () => buildQuestions(organs, config.mode, config.scope === "organ" ? organ : null),
    // `seed` restarts the round with a fresh shuffle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organs, organ, config.mode, config.scope, seed],
  );

  const question = questions[step];
  const finished = step >= questions.length;

  const settle = (correct: boolean, pickedLabel: string, targetLabel: string, atTop: boolean, current: QuizQuestion) => {
    setAnswer({ correct, pickedLabel, targetLabel, atTop });
    setResults((list) => [...list, correct]);
    if (correct) {
      setScore((value) => value + 1);
      setStreak((value) => {
        const next = value + 1;
        setBestStreak((best) => Math.max(best, next));
        return next;
      });
      onLearned(current.organId, current.hotspotId);
    } else {
      setStreak(0);
      setMissed((list) => [...list, current]);
    }
    window.setTimeout(() => {
      setAnswer(null);
      setStep((value) => value + 1);
    }, correct ? HOLD_CORRECT_MS : HOLD_WRONG_MS);
  };

  // Refreshed after every render so the viewer's long-lived callback always
  // sees the current question. Writing a ref in an effect is safe; writing one
  // during render is not.
  useEffect(() => {
    if (config.mode !== "label") {
      pickRef.current = () => {};
      return;
    }
    pickRef.current = (hotspot) => {
      if (!question || answer) return; // ignore extra clicks while feedback shows
      const correct = hotspot.id === question.hotspotId;
      flash(hotspot.id, correct);
      // A miss also marks where the answer actually was — otherwise the learner
      // is told they were wrong but never shown the right structure.
      if (!correct) flash(question.hotspotId, true);
      // Sit the card on the opposite half from the structure being revealed —
      // otherwise the panel hides the dot it is telling the learner to look at.
      const revealed = screenY(correct ? hotspot.id : question.hotspotId);
      settle(correct, hotspot.label, question.label, (revealed ?? 0) > 0.55, question);
    };
  });

  useEffect(() => {
    if (!finished || reported.current) return;
    reported.current = true;
    onFinish(score, questions.length);
  }, [finished, score, questions.length, onFinish]);

  const retry = () => {
    reported.current = false;
    setStep(0);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setAnswer(null);
    setResults([]);
    setMissed([]);
    setSeed((value) => value + 1);
  };

  const answerOption = (optionId: string) => {
    if (!question || answer) return;
    const correct = optionId === question.answerId;
    const picked = question.options.find((option) => option.id === optionId);
    settle(correct, picked?.text ?? "", config.mode === "choice" ? question.label : question.detail, false, question);
  };

  const prompt =
    config.mode === "label" ? t.quiz.find
    : config.mode === "choice" ? t.quiz.choicePrompt
    : format(t.quiz.matchPrompt, { label: question?.label ?? "" });

  const headline =
    config.mode === "label" ? question?.label
    : config.mode === "choice" ? question?.detail
    : question?.label;

  return (
    <>
      {question && (
        <div className="quiz-bar" role="status" aria-live="polite">
          <div className="quiz-prompt">
            <em>{prompt}</em>
            <strong>{headline}</strong>
          </div>
          <div className="quiz-meta">
            <span className="quiz-progress">
              {format(t.quiz.progress, { current: step + 1, total: questions.length })}
            </span>
            <ol className="quiz-pips" aria-hidden>
              {questions.map((item, index) => (
                <li
                  key={item.key}
                  className={index < results.length ? (results[index] ? "ok" : "no") : index === step ? "now" : ""}
                />
              ))}
            </ol>
            {streak >= 2 ? (
              <small className="quiz-streak"><Flame size={12} /> {format(t.quiz.streak, { count: streak })}</small>
            ) : (
              <small>{config.mode === "label" ? t.quiz.hint : ""}</small>
            )}
          </div>
          <button type="button" onClick={onExit} aria-label={t.quiz.exit}><X size={16} /></button>
        </div>
      )}

      {question && config.mode !== "label" && (
        <div className="quiz-options-bar">
          {question.options.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={Boolean(answer)}
              className={
                answer && option.id === question.answerId ? "ok"
                : answer && option.id !== question.answerId ? "dim"
                : ""
              }
              onClick={() => answerOption(option.id)}
            >
              {option.text}
            </button>
          ))}
        </div>
      )}

      {answer && (
        <div
          className={`quiz-answer ${answer.correct ? "ok" : "no"} ${answer.atTop ? "at-top" : ""}`}
          role="status"
          aria-live="assertive"
        >
          <span className="quiz-answer-icon">{answer.correct ? <Check size={22} /> : <X size={22} />}</span>
          <div>
            <strong>{answer.correct ? t.quiz.correct : t.quiz.wrong}</strong>
            {answer.correct ? (
              <span>{answer.targetLabel}</span>
            ) : (
              <>
                <span>{format(t.quiz.reveal, { label: answer.pickedLabel })}</span>
                <span className="quiz-answer-hint">
                  {config.mode === "label"
                    ? format(t.quiz.answer, { label: answer.targetLabel })
                    : answer.targetLabel}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {finished && (
        <div className="quiz-summary" role="dialog" aria-modal="true">
          <span className="modal-icon">{score === questions.length ? "★" : "✓"}</span>
          <h2>{t.quiz.done}</h2>
          <p>{format(t.quiz.score, { score, total: questions.length })}</p>
          {score === questions.length ? (
            <p className="quiz-perfect">{t.quiz.perfect}</p>
          ) : (
            bestStreak >= 2 && <p className="quiz-perfect">{format(t.quiz.streak, { count: bestStreak })}</p>
          )}

          {missed.length > 0 && (
            <div className="quiz-review">
              <span className="panel-label">{t.quiz.reviewTitle}</span>
              <ul>
                {missed.slice(0, 5).map((item) => (
                  <li key={item.key} style={{ "--dot": item.color } as React.CSSProperties}>
                    <b>{item.label}</b> <small>{item.detail}</small>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="quiz-summary-actions">
            <button type="button" className="button-primary" onClick={retry}>{t.quiz.retry}</button>
            <button type="button" className="ghost-button" onClick={onExit}>{t.quiz.exit}</button>
          </div>
        </div>
      )}
    </>
  );
}
