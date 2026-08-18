/**
 * When the anatomical content was last checked over, as an ISO date.
 *
 * Hand-maintained rather than derived from a build timestamp on purpose: for
 * health-adjacent pages `lastReviewed` is a claim that a person looked at the
 * material, and a date that moves on every deploy is a claim that is not true.
 * Update this when the structures, terminology, or clinical notes are revised.
 */
export const REVIEWED_DATE = "2026-08-18";

/** The date the legal pages were last revised, tracked separately. */
export const POLICY_DATE = "2026-08-18";
