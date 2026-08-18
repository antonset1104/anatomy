"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import { format, type UiDictionary } from "../i18n/types";
import { LESSON_STEP_MS, type Lesson } from "../lib/lessons";
import type { OrganId } from "../lib/anatomy-data";

/**
 * Walks a lesson one structure at a time. The player owns only the cursor —
 * moving the camera and selecting the dot is delegated upward, because a
 * cross-organ tour has to switch the loaded specimen between steps.
 */
export function LessonPlayer({
  t,
  lesson,
  reduceMotion,
  onStep,
  onComplete,
  onExit,
}: {
  t: UiDictionary;
  lesson: Lesson;
  reduceMotion: boolean;
  onStep: (organId: OrganId, hotspotId: string) => void;
  onComplete: () => void;
  onExit: () => void;
}) {
  const [index, setIndex] = useState(0);
  // Autoplay would fight a screen reader and anyone who prefers less motion.
  const [playing, setPlaying] = useState(!reduceMotion);
  const [finished, setFinished] = useState(false);
  const completed = useRef(false);
  const step = lesson.steps[index];

  useEffect(() => {
    if (step) onStep(step.organId, step.hotspotId);
    // `onStep` is a fresh closure each render; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.organId, step?.hotspotId]);

  useEffect(() => {
    if (!playing || finished) return;
    const timer = window.setTimeout(() => {
      setIndex((value) => {
        if (value + 1 >= lesson.steps.length) {
          setFinished(true);
          return value;
        }
        return value + 1;
      });
    }, LESSON_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, finished, index, lesson.steps.length]);

  useEffect(() => {
    if (!finished || completed.current) return;
    completed.current = true;
    onComplete();
  }, [finished, onComplete]);

  const go = (delta: number) => {
    setPlaying(false);
    setIndex((value) => {
      const next = value + delta;
      if (next < 0) return 0;
      if (next >= lesson.steps.length) {
        setFinished(true);
        return value;
      }
      return next;
    });
  };

  if (finished) {
    return (
      <div className="lesson-done" role="dialog" aria-modal="true">
        <span className="modal-icon">✦</span>
        <h2>{t.lessons.complete}</h2>
        <p>{format(t.lessons.completeBody, { count: lesson.steps.length, organ: lesson.title })}</p>
        <div className="quiz-summary-actions">
          <button
            type="button"
            className="button-primary"
            onClick={() => {
              completed.current = false;
              setIndex(0);
              setFinished(false);
              setPlaying(false);
            }}
          >
            {t.lessons.replay}
          </button>
          <button type="button" className="ghost-button" onClick={onExit}>{t.lessons.exit}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="lesson-bar" role="region" aria-label={t.lessons.title}>
      <div className="lesson-progress" aria-hidden>
        <i style={{ inlineSize: `${((index + 1) / lesson.steps.length) * 100}%` }} />
      </div>

      <div className="lesson-copy" style={{ "--dot": step?.color } as React.CSSProperties}>
        <em>{format(t.lessons.step, { current: index + 1, total: lesson.steps.length })}</em>
        <strong>{step?.label}</strong>
        <p>{step?.detail}</p>
      </div>

      <div className="lesson-controls">
        <button type="button" className="icon-button" onClick={() => go(-1)} disabled={index === 0} aria-label={t.lessons.prev}>
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => setPlaying((value) => !value)}
          aria-label={playing ? t.lessons.pause : t.lessons.autoplay}
        >
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <button type="button" className="icon-button" onClick={() => go(1)} aria-label={t.lessons.next}>
          <ChevronRight size={16} />
        </button>
        <button type="button" className="icon-button" onClick={onExit} aria-label={t.lessons.exit}>
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
