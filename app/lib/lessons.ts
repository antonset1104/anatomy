import type { Organ } from "../i18n/merge";
import type { OrganId } from "./anatomy-data";

export type LessonStep = {
  organId: OrganId;
  hotspotId: string;
  label: string;
  detail: string;
  color: string;
};

export type Lesson = {
  id: string;
  /** Which specimen the lesson belongs to, or null for a cross-organ tour. */
  organId: OrganId | null;
  title: string;
  subtitle: string;
  steps: LessonStep[];
};

function toStep(organ: Organ, hotspotId: string): LessonStep | null {
  const hotspot = organ.hotspots.find((item) => item.id === hotspotId);
  if (!hotspot) return null;
  return {
    organId: organ.id,
    hotspotId: hotspot.id,
    label: hotspot.label,
    detail: hotspot.detail,
    color: hotspot.color,
  };
}

/**
 * Lessons are derived rather than authored: teaching weight already encodes
 * "look at this first", so a lesson is that ordering made walkable. Narration
 * reuses the hotspot copy, which means a new locale gets working lessons the
 * moment its structure labels land.
 */
export function buildLesson(organ: Organ): Lesson {
  const ordered = [...organ.hotspots].sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1));
  return {
    id: `organ:${organ.id}`,
    organId: organ.id,
    title: organ.name,
    subtitle: organ.poetic,
    steps: ordered.map((hotspot) => toStep(organ, hotspot.id)!).filter(Boolean),
  };
}

export function buildLessons(organs: Organ[]): Lesson[] {
  return organs.map(buildLesson);
}

/** One headline structure from every specimen, in curriculum order. */
export function buildGrandTour(organs: Organ[], title: string, subtitle: string): Lesson {
  const order: Record<string, number> = { foundation: 0, intermediate: 1, advanced: 2 };
  const steps = [...organs]
    .sort((a, b) => order[a.difficulty] - order[b.difficulty])
    .map((organ) => {
      const headline = [...organ.hotspots].sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1))[0];
      return headline ? toStep(organ, headline.id) : null;
    })
    .filter((step): step is LessonStep => Boolean(step));

  return { id: "tour:grand", organId: null, title, subtitle, steps };
}

export const LESSON_STEP_MS = 6200;
