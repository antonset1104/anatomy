"use client";

import { useCallback, useSyncExternalStore } from "react";
import { organIds, totalStructures, type OrganId } from "./anatomy-data";

/**
 * Everything the learner accumulates, kept on the device. There is no account
 * and nothing is uploaded — the D1 binding in this template stays unused, which
 * keeps the app deployable as pure static + worker with no privacy surface.
 */
export type Progress = {
  /** Specimen ids in the order they were first opened. */
  visited: OrganId[];
  /** `${organId}:${hotspotId}` for every structure marked as learned. */
  learned: string[];
  bookmarks: OrganId[];
  /** Keyed by organ id. */
  notes: Record<string, { text: string; updatedAt: number }>;
  quizzes: { taken: number; best: number; correct: number; answered: number };
  lessonsDone: string[];
  streak: { count: number; lastDay: string };
  achievements: string[];
};

export type Prefs = {
  theme: "light" | "dark" | "system";
  reduceMotion: boolean;
  quality: "auto" | "high" | "low";
  alwaysLabels: boolean;
  textSize: "sm" | "md" | "lg";
};

export type StoreState = { progress: Progress; prefs: Prefs; hydrated: boolean };

const STORAGE_KEY = "anatomy-atelier:v2";

export const DEFAULT_STATE: StoreState = Object.freeze<StoreState>({
  progress: {
    visited: [],
    learned: [],
    bookmarks: [],
    notes: {},
    quizzes: { taken: 0, best: 0, correct: 0, answered: 0 },
    lessonsDone: [],
    streak: { count: 0, lastDay: "" },
    achievements: [],
  },
  prefs: { theme: "system", reduceMotion: false, quality: "auto", alwaysLabels: false, textSize: "md" },
  hydrated: false,
});

let state: StoreState = DEFAULT_STATE;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Lets a component react to store changes outside of render — used by the
 *  toast layer, which has to notice a badge the moment it is awarded. */
export function subscribeToStore(listener: () => void) {
  return subscribe(listener);
}

function getSnapshot() {
  return state;
}

/**
 * The server has no storage, so it always renders the defaults. The client
 * renders the same defaults on its first pass and only then hydrates from
 * localStorage, which keeps the markup identical and avoids a mismatch.
 */
function getServerSnapshot() {
  return DEFAULT_STATE;
}

let writeTimer: number | undefined;

function persist() {
  if (typeof window === "undefined") return;
  window.clearTimeout(writeTimer);
  writeTimer = window.setTimeout(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ progress: state.progress, prefs: state.prefs }),
      );
    } catch {
      // Private browsing or a full quota — the session still works, it just
      // will not be remembered.
    }
  }, 180);
}

function set(next: Partial<StoreState>, options: { persist?: boolean } = {}) {
  state = { ...state, ...next };
  if (options.persist !== false) persist();
  emit();
}

function setProgress(update: (progress: Progress) => Progress) {
  set({ progress: update(state.progress) });
  awardAchievements();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dayBefore(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Reads the persisted blob once, on mount. Unknown keys are dropped so an old
 *  or hand-edited payload can never crash the app. */
export function hydrate() {
  if (state.hydrated || typeof window === "undefined") return;
  let stored: unknown = null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    stored = raw ? JSON.parse(raw) : null;
  } catch {
    stored = null;
  }

  const saved = (stored ?? {}) as Partial<{ progress: Partial<Progress>; prefs: Partial<Prefs> }>;
  const progress: Progress = {
    ...DEFAULT_STATE.progress,
    ...saved.progress,
    quizzes: { ...DEFAULT_STATE.progress.quizzes, ...saved.progress?.quizzes },
    streak: { ...DEFAULT_STATE.progress.streak, ...saved.progress?.streak },
    notes: { ...saved.progress?.notes },
    visited: (saved.progress?.visited ?? []).filter((id): id is OrganId => organIds.includes(id as OrganId)),
  };

  // Touch the streak on the first interaction of the day: same day is a no-op,
  // yesterday extends it, anything older starts again at one.
  const day = today();
  if (progress.streak.lastDay !== day) {
    progress.streak = {
      count: progress.streak.lastDay === dayBefore(day) ? progress.streak.count + 1 : 1,
      lastDay: day,
    };
  }

  set({ progress, prefs: { ...DEFAULT_STATE.prefs, ...saved.prefs }, hydrated: true });
}

// ------------------------------------------------------------------ actions

export const actions = {
  visit(organId: OrganId) {
    if (state.progress.visited.includes(organId)) return;
    setProgress((progress) => ({ ...progress, visited: [...progress.visited, organId] }));
  },

  toggleBookmark(organId: OrganId) {
    const has = state.progress.bookmarks.includes(organId);
    setProgress((progress) => ({
      ...progress,
      bookmarks: has ? progress.bookmarks.filter((id) => id !== organId) : [...progress.bookmarks, organId],
    }));
    return !has;
  },

  toggleLearned(organId: OrganId, hotspotId: string) {
    const key = `${organId}:${hotspotId}`;
    const has = state.progress.learned.includes(key);
    setProgress((progress) => ({
      ...progress,
      learned: has ? progress.learned.filter((item) => item !== key) : [...progress.learned, key],
    }));
    return !has;
  },

  markLearned(organId: OrganId, hotspotId: string) {
    const key = `${organId}:${hotspotId}`;
    if (state.progress.learned.includes(key)) return;
    setProgress((progress) => ({ ...progress, learned: [...progress.learned, key] }));
  },

  saveNote(organId: OrganId, text: string) {
    setProgress((progress) => {
      const notes = { ...progress.notes };
      if (text.trim()) notes[organId] = { text, updatedAt: Date.now() };
      else delete notes[organId];
      return { ...progress, notes };
    });
  },

  recordQuiz(score: number, total: number) {
    setProgress((progress) => ({
      ...progress,
      quizzes: {
        taken: progress.quizzes.taken + 1,
        best: Math.max(progress.quizzes.best, total ? Math.round((score / total) * 100) : 0),
        correct: progress.quizzes.correct + score,
        answered: progress.quizzes.answered + total,
      },
    }));
  },

  completeLesson(lessonId: string) {
    if (state.progress.lessonsDone.includes(lessonId)) return;
    setProgress((progress) => ({ ...progress, lessonsDone: [...progress.lessonsDone, lessonId] }));
  },

  setPrefs(patch: Partial<Prefs>) {
    set({ prefs: { ...state.prefs, ...patch } });
  },

  resetProgress() {
    set({ progress: { ...DEFAULT_STATE.progress, streak: { count: 1, lastDay: today() } } });
  },
};

// ------------------------------------------------------------- achievements

const ACHIEVEMENT_RULES: { id: string; earned: (progress: Progress) => boolean }[] = [
  { id: "first-specimen", earned: (p) => p.visited.length >= 1 },
  { id: "all-specimens", earned: (p) => p.visited.length >= organIds.length },
  { id: "first-quiz", earned: (p) => p.quizzes.taken >= 1 },
  { id: "perfect-quiz", earned: (p) => p.quizzes.best >= 100 },
  { id: "first-lesson", earned: (p) => p.lessonsDone.length >= 1 },
  { id: "note-taker", earned: (p) => Object.keys(p.notes).length >= 3 },
  { id: "curator", earned: (p) => p.bookmarks.length >= 5 },
  { id: "half-mastery", earned: (p) => p.learned.length >= totalStructures / 2 },
  { id: "full-mastery", earned: (p) => p.learned.length >= totalStructures },
  { id: "streak-three", earned: (p) => p.streak.count >= 3 },
];

export const achievementIds = ACHIEVEMENT_RULES.map((rule) => rule.id);

/** Recomputed from the whole progress object rather than incremented, so an
 *  imported or repaired payload always lands on the right badges. */
function awardAchievements() {
  const earned = ACHIEVEMENT_RULES.filter((rule) => rule.earned(state.progress)).map((rule) => rule.id);
  const fresh = earned.filter((id) => !state.progress.achievements.includes(id));
  if (!fresh.length) return;
  state = { ...state, progress: { ...state.progress, achievements: earned } };
  persist();
  emit();
  newAchievements.push(...fresh);
}

/** Drained by the toast layer so a badge announces itself once. */
export const newAchievements: string[] = [];

// -------------------------------------------------------------------- hooks

export function useStore(): StoreState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useStoreSelector<T>(select: (state: StoreState) => T): T {
  const selector = useCallback(() => select(getSnapshot()), [select]);
  const server = useCallback(() => select(getServerSnapshot()), [select]);
  return useSyncExternalStore(subscribe, selector, server);
}

export function masteryPercent(progress: Progress) {
  return totalStructures ? Math.round((progress.learned.length / totalStructures) * 100) : 0;
}

export function organMastery(progress: Progress, organId: OrganId, hotspotCount: number) {
  if (!hotspotCount) return 0;
  const prefix = `${organId}:`;
  const learned = progress.learned.filter((key) => key.startsWith(prefix)).length;
  return Math.round((learned / hotspotCount) * 100);
}
