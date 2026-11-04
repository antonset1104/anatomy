export type LearningEvent = "content_open" | "content_complete" | "quiz_complete" | "simulator_start";

type LearningEventDetails = {
  contentId: string;
  contentGroup: "anatomy_3d" | "medical_study";
  language: string;
  feature?: string;
};

type AnalyticsWindow = Window & { gtag?: (...args: unknown[]) => void };

const safeValue = /^[a-z0-9][a-z0-9:-]{0,63}$/;

export function trackLearningEvent(name: LearningEvent, details: LearningEventDetails): void {
  if (typeof window === "undefined") return;
  const gtag = (window as AnalyticsWindow).gtag;
  if (typeof gtag !== "function" || !safeValue.test(details.contentId) || !safeValue.test(details.language)) return;
  if (details.feature && !safeValue.test(details.feature)) return;

  gtag("event", name, {
    content_id: details.contentId,
    content_group: details.contentGroup,
    content_locale: details.language,
    ...(details.feature ? { feature: details.feature } : {}),
  });
}
