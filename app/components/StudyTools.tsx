"use client";

import { useState, useSyncExternalStore } from "react";
import type { StudyModule } from "../lib/medical-study";
import { studyUi } from "../lib/student-ui";

const STORAGE_KEY = "anatomy-medical-study-v1";
const emptyProgress: string[] = [];
let cachedRaw: string | null | undefined;
let cachedProgress: string[] = emptyProgress;
function getProgress(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      const value: unknown = JSON.parse(raw ?? "[]");
      cachedProgress = Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && id.length < 80).slice(0, 100) : [];
    }
  } catch { /* Blocked storage keeps the in-memory snapshot available. */ }
  return cachedProgress;
}
function subscribeProgress(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(STORAGE_KEY, notify);
  return () => { window.removeEventListener("storage", notify); window.removeEventListener(STORAGE_KEY, notify); };
}
const serverProgress = () => emptyProgress;
function save(ids: string[]) {
  cachedProgress = ids;
  const serialized = JSON.stringify(ids);
  try { localStorage.setItem(STORAGE_KEY, serialized); cachedRaw = serialized; } catch { /* In-memory progress remains available. */ }
  window.dispatchEvent(new Event(STORAGE_KEY));
}

export function StudyTools({ modules, locale, progressOnly = false }: { modules: StudyModule[]; locale: string; progressOnly?: boolean }) {
  const t = studyUi(locale);
  const completed = useSyncExternalStore(subscribeProgress, getProgress, serverProgress);
  const [filter, setFilter] = useState("all");
  const [mode, setMode] = useState<"quiz" | "cards">("quiz");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState<string[]>([]);
  const [card, setCard] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const questions = modules.filter(m => filter === "all" || m.id === filter).flatMap(m => m.questions);
  const correct = questions.filter(q => checked.includes(q.id) && selected[q.id] === q.answer).length;
  const attempted = questions.filter(q => checked.includes(q.id)).length;
  const current = questions[card % Math.max(questions.length, 1)];

  return <section className="study-tools" aria-label={t.practice}>
    <h2>{t.progress}</h2>
    <p aria-live="polite">{modules.filter(m => completed.includes(m.id)).length} / {modules.length}</p>
    <div className="study-checklist">
      {modules.map(m => <label key={m.id}><input type="checkbox" checked={completed.includes(m.id)} onChange={() => save(completed.includes(m.id) ? completed.filter(id => id !== m.id) : [...completed, m.id])} /> {m.title}</label>)}
    </div>
    <p className="study-note">{t.storage}</p>
    <button type="button" onClick={() => { if (window.confirm(t.clearConfirm)) save(completed.filter(id => !modules.some(m => m.id === id))); }}>{t.clear}</button>
    {!progressOnly && <>
      <h2>{t.practice}</h2>
      <div className="study-controls">
        <label>{t.filter} <select value={filter} onChange={e => { setFilter(e.target.value); setCard(0); setFlipped(false); }}><option value="all">{t.all}</option>{modules.map(m => <option value={m.id} key={m.id}>{m.title}</option>)}</select></label>
        <button type="button" aria-pressed={mode === "quiz"} onClick={() => setMode("quiz")}>{t.quiz}</button>
        <button type="button" aria-pressed={mode === "cards"} onClick={() => setMode("cards")}>{t.flashcards}</button>
      </div>
      {mode === "quiz" ? <>
        <p role="status">{t.score}: {correct} / {attempted} · {attempted} / {questions.length}</p>
        {questions.map((q, index) => <fieldset className="study-question" key={q.id}>
          <legend>{index + 1}. {q.prompt}</legend>
          {q.options.map((option, i) => <label key={option}><input type="radio" name={q.id} value={i} checked={selected[q.id] === i} disabled={checked.includes(q.id)} onChange={() => setSelected({ ...selected, [q.id]: i })} /> {option}</label>)}
          {!checked.includes(q.id) && <button type="button" disabled={selected[q.id] === undefined} onClick={() => setChecked([...checked, q.id])}>{t.check}</button>}
          {checked.includes(q.id) && <div className="study-feedback" role="status"><strong>{selected[q.id] === q.answer ? t.correct : t.incorrect}. {t.answer}: {q.options[q.answer]}</strong><p>{q.explanation}</p></div>}
        </fieldset>)}
        <button type="button" onClick={() => { setSelected({}); setChecked([]); }}>{t.reset}</button>
      </> : current && <div className="study-flashcard">
        <p>{card + 1} / {questions.length}</p><h3>{current.prompt}</h3>
        <button type="button" aria-expanded={flipped} onClick={() => setFlipped(!flipped)}>{flipped ? t.hide : t.flip}</button>
        {flipped && <div role="status"><strong>{current.options[current.answer]}</strong><p>{current.explanation}</p></div>}
        <div className="study-controls"><button type="button" onClick={() => { setCard((card - 1 + questions.length) % questions.length); setFlipped(false); }}>{t.previous}</button><button type="button" onClick={() => { setCard((card + 1) % questions.length); setFlipped(false); }}>{t.next}</button></div>
      </div>}
    </>}
    <h2>{t.planner}</h2><p>{t.plan}</p>
    <button type="button" onClick={() => window.print()}>{t.print}</button>
  </section>;
}
