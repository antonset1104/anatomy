import type { OrganId } from "../lib/anatomy-data";

/** Prose for one organ. Structure (positions, colours, model) lives in
 *  `anatomy-data.ts`; only translatable text belongs here. */
export type OrganContent = {
  name: string;
  system: string;
  description: string;
  poetic: string;
  size: string;
  weight: string;
  location: string;
  function: string;
  dailyFact: string;
  medical: string;
  bloodSupply: string;
  funFact: string;
  tissue: string;
  comparison: string;
  conditions: string[];
  /** Keyed by hotspot id — the Terminologia Anatomica term is the anchor. */
  hotspots: Record<string, { label: string; detail: string }>;
};

export type OrganContentDictionary = Record<OrganId, OrganContent>;

export type UiDictionary = {
  meta: { title: string; description: string; ogTitle: string; ogDescription: string; imageAlt: string };
  brand: { tagline: string; home: string; skip: string };
  nav: {
    explore: string; systems: string; lessons: string; library: string; notes: string;
    quiz: string; progress: string; glossary: string;
  };
  search: {
    placeholder: string; noResults: string; organs: string; structures: string;
    systems: string; lessons: string; actions: string; clear: string;
  };
  command: { open: string; placeholder: string; hint: string; navigate: string; select: string; close: string };
  theme: { label: string; light: string; dark: string; system: string };
  profile: { open: string };
  language: { label: string; choose: string };
  library: {
    title: string; open: string; close: string; saved: string; viewAll: string;
    quoteLine1: string; quoteLine2: string; quoteSign: string;
    filterAll: string; filterLabel: string; count: string; bookmarkedOnly: string; emptyFilter: string;
  };
  difficulty: { label: string; foundation: string; intermediate: string; advanced: string };
  tools: {
    label: string; rotate: string; zoom: string; zoomOut: string; isolate: string; section: string;
    layers: string; compare: string; reset: string; xray: string; labels: string;
    fullscreen: string; exitFullscreen: string; screenshot: string; measure: string; more: string;
  };
  views: { label: string; anterior: string; posterior: string; left: string; right: string; superior: string; inferior: string };
  section: { title: string; axis: string; depth: string; flip: string; x: string; y: string; z: string };
  viewer: {
    title: string; canvas: string; tip: string; tipDrag: string; tipScroll: string; tipClick: string;
    loading: string; autoRotate: string; caption: string; structures: string;
    webglTitle: string; webglBody: string; retry: string;
    measureHint: string; measureResult: string; measureClear: string;
    captured: string; keyboardHint: string;
  };
  inspector: { overview: string; structures: string; clinical: string; physiology: string; notes: string };
  info: {
    kicker: string; keyFacts: string; size: string; weight: string; daily: string;
    location: string; bloodSupply: string; function: string; medical: string;
    didYouKnow: string; viewLesson: string; animate: string; quiz: string; compare: string;
    related: string; system: string; mastery: string; startLesson: string;
  };
  structures: {
    title: string; count: string; layerAll: string; focus: string;
    surface: string; chamber: string; vessel: string; duct: string; nerve: string; deep: string;
    learned: string; markLearned: string;
  };
  physiology: { title: string; subtitle: string; healthyRange: string; value: string; noData: string };
  metrics: Record<string, string>;
  clinical: { title: string; conditions: string; note: string; disclaimer: string; tissue: string };
  notes: {
    title: string; placeholder: string; save: string; saved: string; clear: string;
    export: string; empty: string; count: string; lastEdited: string;
  };
  bookmarks: { add: string; remove: string; title: string; empty: string; added: string; removed: string };
  progress: {
    title: string; subtitle: string; visited: string; mastery: string; streak: string;
    /** English inflects, so the streak carries both forms. */
    streakUnit: string; streakUnitOne: string;
    quizzes: string; bestScore: string; structuresLearned: string; reset: string; resetDone: string;
    achievements: string; locked: string; close: string;
  };
  achievements: Record<string, { name: string; hint: string }>;
  lessons: {
    title: string; subtitle: string; start: string; resume: string; replay: string; step: string;
    next: string; prev: string; finish: string; autoplay: string; pause: string;
    complete: string; completeBody: string; exit: string; intro: string; outro: string; duration: string;
    tourTitle: string; tourBody: string;
  };
  quiz: {
    start: string; find: string; progress: string; correct: string; wrong: string;
    reveal: string; answer: string; done: string; score: string; retry: string; exit: string; hint: string;
    chooseMode: string; modeLabel: string; modeLabelBody: string; modeChoice: string; modeChoiceBody: string;
    modeMatch: string; modeMatchBody: string; scopeOrgan: string; scopeAll: string; scope: string;
    choicePrompt: string; matchPrompt: string; skip: string; nextQuestion: string;
    streak: string; perfect: string; mastered: string; reviewTitle: string; timer: string; begin: string;
  };
  compare: {
    title: string; comparing: string; reference: string; primaryRole: string; scale: string; vs: string; close: string;
    pick: string; swap: string; sync: string; open: string; table: string; metric: string; difference: string;
  };
  systems: { title: string; subtitle: string; organCount: string; open: string; explore: string };
  /** Keyed by SystemId — the taxonomy itself lives in `anatomy-data.ts`. */
  systemNames: Record<string, { name: string; role: string }>;
  glossary: { title: string; subtitle: string; placeholder: string; term: string; latin: string; empty: string; copy: string };
  share: { label: string; copy: string; copied: string; native: string; title: string; body: string };
  settings: {
    title: string; subtitle: string; motion: string; motionBody: string; quality: string;
    qualityAuto: string; qualityHigh: string; qualityLow: string; labelsAlways: string; labelsAlwaysBody: string;
    textSize: string; textSmall: string; textNormal: string; textLarge: string; close: string;
  };
  print: { button: string; title: string; generated: string; source: string };
  cards: {
    resources: string; microscopic: string; compareOrgans: string; functionAnimation: string;
    clinicalNotes: string; whereItWorks: string; commonConditions: string;
    exploreTissue: string; openComparison: string; playAnimation: string; seeAll: string; seeSystem: string;
    playAria: string; systemAria: string;
  };
  modal: {
    guided: string; close: string; continueExploring: string;
    quizTitle: string; motionTitle: string; bodyTitle: string; insideTitle: string;
    quizPrompt: string; quizA: string; quizB: string; quizC: string;
    lessonBody: string; systemIntro: string; system: string; primaryRole: string; bloodSupply: string;
  };
  /** Copy for the indexable content pages that live outside the 3D studio. */
  site: {
    openStudio: string; backToStudio: string; exploreIn3d: string; home: string;
    nav: string; footerNote: string; footerRights: string;
    breadcrumb: string; onThisPage: string; updated: string;
  };
  article: {
    intro: string; anatomy: string; structures: string; physiology: string;
    clinical: string; related: string; inSystem: string; latinTerm: string;
    structureCount: string; viewStructure: string; keyFacts: string;
    quickAnswer: string; sources: string; reviewed: string;
  };
  pages: {
    organsTitle: string; organsDescription: string;
    systemsTitle: string; systemsDescription: string;
    glossaryTitle: string; glossaryDescription: string;
    lessonsTitle: string; lessonsDescription: string;
    aboutTitle: string; aboutDescription: string;
    privacyTitle: string; privacyDescription: string;
  };
  about: {
    lead: string;
    whatHeading: string; whatBody: string;
    howHeading: string; howBody: string;
    namingHeading: string; namingBody: string;
    limitsHeading: string; limitsBody: string;
    contactHeading: string; contactBody: string;
  };
  privacy: {
    lead: string;
    storageHeading: string; storageBody: string;
    analyticsHeading: string; analyticsBody: string;
    adsHeading: string; adsBody: string;
    childrenHeading: string; childrenBody: string;
    rightsHeading: string; rightsBody: string;
    changesHeading: string; changesBody: string;
  };
  seo: {
    organTitle: string; organDescription: string;
    systemTitle: string; systemDescription: string;
  };
  ads: { label: string };
  common: { close: string; back: string; next: string; done: string; cancel: string; of: string; new: string };
};

/** Locale files other than `en` only override what they have translated; the
 *  English dictionary is always merged underneath so nothing renders empty. */
export type DeepPartial<T> = T extends readonly (infer U)[]
  ? U[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export type UiPatch = DeepPartial<UiDictionary>;
export type OrganContentPatch = DeepPartial<OrganContentDictionary>;

export type Dictionary = { ui: UiDictionary; organs: OrganContentDictionary };

/** Minimal `{name}` interpolation — the copy has no plurals or dates. */
export function format(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}
