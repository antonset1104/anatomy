import type { Organ } from "../i18n/merge";
import type { OrganId } from "./anatomy-data";

export type QuizMode = "label" | "choice" | "match";
export type QuizScope = "organ" | "all";

export type QuizOption = { id: string; text: string; organId: OrganId; hotspotId: string };

export type QuizQuestion = {
  /** Stable across a round so React keys and the answer log line up. */
  key: string;
  organId: OrganId;
  hotspotId: string;
  /** The structure name — the answer for `choice`, the prompt for `match`. */
  label: string;
  /** What the structure does — the prompt for `choice`, the answer for `match`. */
  detail: string;
  color: string;
  options: QuizOption[];
  answerId: string;
};

/** Fisher–Yates. Every round asks in a fresh order. */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type Pool = { organ: Organ; hotspotId: string; label: string; detail: string; color: string };

function pool(organs: Organ[]): Pool[] {
  return organs.flatMap((organ) =>
    organ.hotspots.map((hotspot) => ({
      organ,
      hotspotId: hotspot.id,
      label: hotspot.label,
      detail: hotspot.detail,
      color: hotspot.color,
    })),
  );
}

const MAX_QUESTIONS = 12;
const OPTION_COUNT = 4;

/**
 * Distractors are drawn from the same specimen first, because "which of these
 * four heart structures" is the question a learner actually needs to answer.
 * Only when a specimen is too small does the pool widen to other organs.
 */
function distractors(all: Pool[], correct: Pool, key: "label" | "detail") {
  const sameOrgan = all.filter((item) => item.organ.id === correct.organ.id && item.hotspotId !== correct.hotspotId);
  const others = all.filter((item) => item.organ.id !== correct.organ.id && item[key] !== correct[key]);
  const picked: Pool[] = [];
  const seen = new Set([correct[key]]);

  for (const candidate of [...shuffle(sameOrgan), ...shuffle(others)]) {
    if (picked.length >= OPTION_COUNT - 1) break;
    if (seen.has(candidate[key])) continue;
    seen.add(candidate[key]);
    picked.push(candidate);
  }
  return picked;
}

export function buildQuestions(organs: Organ[], mode: QuizMode, scopeOrgan: Organ | null): QuizQuestion[] {
  const source = scopeOrgan ? [scopeOrgan] : organs;
  const items = pool(source);
  const everything = pool(organs);

  // The label mode is answered by clicking the model, so it needs no options
  // and stays inside one specimen.
  if (mode === "label") {
    return shuffle(items)
      .slice(0, MAX_QUESTIONS)
      .map((item) => ({
        key: `${item.organ.id}:${item.hotspotId}`,
        organId: item.organ.id,
        hotspotId: item.hotspotId,
        label: item.label,
        detail: item.detail,
        color: item.color,
        options: [],
        answerId: `${item.organ.id}:${item.hotspotId}`,
      }));
  }

  const answerKey = mode === "choice" ? "label" : "detail";
  return shuffle(items)
    .slice(0, MAX_QUESTIONS)
    .map((item) => {
      const wrong = distractors(everything, item, answerKey);
      const options = shuffle(
        [item, ...wrong].map((candidate) => ({
          id: `${candidate.organ.id}:${candidate.hotspotId}`,
          text: candidate[answerKey],
          organId: candidate.organ.id,
          hotspotId: candidate.hotspotId,
        })),
      );
      return {
        key: `${item.organ.id}:${item.hotspotId}`,
        organId: item.organ.id,
        hotspotId: item.hotspotId,
        label: item.label,
        detail: item.detail,
        color: item.color,
        options,
        answerId: `${item.organ.id}:${item.hotspotId}`,
      };
    });
}
