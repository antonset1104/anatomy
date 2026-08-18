// STRUCTURE ONLY — no translatable prose lives here.
// Every organ and hotspot is identified by a stable id plus its Terminologia
// Anatomica (TA2) Latin term, which is the canonical key locale files translate
// against. Positions, colours, and model paths are locale-independent.

export type OrganId =
  | "heart"
  | "brain"
  | "lungs"
  | "liver"
  | "kidneys"
  | "eyeball"
  | "intestine"
  | "pancreas"
  | "skin";

export type SystemId =
  | "cardiovascular"
  | "nervous"
  | "respiratory"
  | "digestive"
  | "urinary"
  | "endocrine"
  | "sensory"
  | "integumentary";

/** Difficulty drives lesson ordering and quiz weighting. */
export type Difficulty = "foundation" | "intermediate" | "advanced";

export type HotspotStructure = {
  id: string;
  /** Terminologia Anatomica term — the canonical identity across all locales. */
  ta: string;
  position: [number, number, number];
  color: string;
  /** Coarse tissue class, used by the layer filter in the viewer. */
  layer: "surface" | "chamber" | "vessel" | "duct" | "nerve" | "deep";
  /** Relative teaching weight — the quiz asks about higher numbers first. */
  weight?: number;
};

/**
 * One measurable physiological quantity. Numeric so the inspector can chart it
 * without parsing prose, `unit` and `label` keys resolve through the dictionary.
 */
export type Metric = {
  id: string;
  value: number;
  /** Ceiling used to draw the bar — the largest value that still reads as normal. */
  max: number;
  unit: string;
  /** Optional healthy band, drawn as a shaded region. */
  band?: [number, number];
};

export type OrganStructure = {
  id: OrganId;
  system: SystemId;
  model: string;
  icon: string;
  accent: string;
  /** Second accent used for gradients and charts. */
  accentAlt: string;
  /** Whether `/anatomy/<id>/*.webp` illustrations exist. */
  illustrated: boolean;
  /** Latin binomial — intentionally identical in every locale. */
  scientificName: string;
  difficulty: Difficulty;
  /** Rough triangle budget of the GLB, so the loader can warn on slow links. */
  approxBytes: number;
  /** Longest real-world dimension in millimetres. Models are normalised to a
   *  fixed cube, so this is what turns a measurement back into life size. */
  realSizeMm: number;
  /** Sibling organs worth opening next. */
  related: OrganId[];
  /** Numeric facts, charted rather than written out. */
  metrics: Metric[];
  hotspots: HotspotStructure[];
};

export type SystemStructure = {
  id: SystemId;
  icon: string;
  accent: string;
  organs: OrganId[];
};

const CORAL = "#ee7c6a";
const AMBER = "#f2a33b";
const AZURE = "#6393d8";
const MAUVE = "#d89bc4";
const SAGE = "#7fa88a";
const VIOLET = "#9a86d4";
const TEAL = "#6bb0b3";

export const organStructures: OrganStructure[] = [
  {
    id: "heart",
    system: "cardiovascular",
    model: "/models/heart.glb",
    icon: "♥",
    accent: "#ee7c6a",
    accentAlt: "#c9556b",
    illustrated: true,
    scientificName: "Cor",
    difficulty: "foundation",
    approxBytes: 2_900_000,
    realSizeMm: 120,
    related: ["lungs", "kidneys"],
    metrics: [
      { id: "rate", value: 72, max: 200, unit: "bpm", band: [60, 100] },
      { id: "output", value: 5, max: 25, unit: "L/min", band: [4, 8] },
      { id: "ejection", value: 62, max: 100, unit: "%", band: [55, 70] },
      { id: "mass", value: 300, max: 500, unit: "g", band: [250, 350] },
    ],
    hotspots: [
      { id: "aorta", ta: "Aorta", position: [-0.35, 1.65, 0.55], color: CORAL, layer: "vessel", weight: 3 },
      { id: "left-atrium", ta: "Atrium sinistrum", position: [0.82, 0.65, 0.5], color: AMBER, layer: "chamber", weight: 3 },
      { id: "right-atrium", ta: "Atrium dextrum", position: [-0.9, 0.35, 0.55], color: AZURE, layer: "chamber", weight: 3 },
      { id: "left-ventricle", ta: "Ventriculus sinister", position: [0.7, -0.75, 0.65], color: AMBER, layer: "chamber", weight: 3 },
      { id: "right-ventricle", ta: "Ventriculus dexter", position: [-0.65, -0.68, 0.66], color: CORAL, layer: "chamber", weight: 3 },
      { id: "mitral", ta: "Valva atrioventricularis sinistra", position: [0.18, -1.35, 0.48], color: MAUVE, layer: "deep", weight: 2 },
      { id: "pulmonary-trunk", ta: "Truncus pulmonalis", position: [0.55, 1.5, 0.35], color: AZURE, layer: "vessel", weight: 2 },
      { id: "superior-vena-cava", ta: "Vena cava superior", position: [-1.05, 1.2, 0.3], color: TEAL, layer: "vessel", weight: 2 },
      { id: "apex", ta: "Apex cordis", position: [0.35, -1.7, 0.4], color: VIOLET, layer: "surface", weight: 1 },
      { id: "coronary-artery", ta: "Arteria coronaria sinistra", position: [0.95, -0.15, 0.9], color: SAGE, layer: "vessel", weight: 2 },
    ],
  },
  {
    id: "brain",
    system: "nervous",
    model: "/models/brain.glb",
    icon: "◉",
    accent: "#c58696",
    accentAlt: "#8d6bcc",
    illustrated: true,
    scientificName: "Encephalon",
    difficulty: "intermediate",
    approxBytes: 3_400_000,
    realSizeMm: 167,
    related: ["eyeball", "skin"],
    metrics: [
      { id: "mass", value: 1350, max: 2000, unit: "g", band: [1250, 1450] },
      { id: "neurons", value: 86, max: 120, unit: "×10⁹" },
      { id: "energy", value: 20, max: 100, unit: "%", band: [18, 22] },
      { id: "flow", value: 750, max: 1200, unit: "mL/min", band: [700, 800] },
    ],
    hotspots: [
      { id: "frontal", ta: "Lobus frontalis", position: [-0.7, 0.65, 0.8], color: CORAL, layer: "surface", weight: 3 },
      { id: "parietal", ta: "Lobus parietalis", position: [0.15, 1.1, 0.65], color: AMBER, layer: "surface", weight: 3 },
      { id: "temporal", ta: "Lobus temporalis", position: [0.75, -0.1, 0.82], color: AZURE, layer: "surface", weight: 3 },
      { id: "cerebellum", ta: "Cerebellum", position: [0.72, -0.9, 0.55], color: MAUVE, layer: "surface", weight: 3 },
      { id: "occipital", ta: "Lobus occipitalis", position: [1.25, 0.35, 0.1], color: SAGE, layer: "surface", weight: 2 },
      { id: "brainstem", ta: "Truncus encephali", position: [0.1, -1.35, 0.3], color: VIOLET, layer: "deep", weight: 2 },
      { id: "central-sulcus", ta: "Sulcus centralis", position: [-0.2, 1.15, 0.85], color: TEAL, layer: "surface", weight: 1 },
    ],
  },
  {
    id: "lungs",
    system: "respiratory",
    model: "/models/lungs.glb",
    icon: "◍",
    accent: "#dd8f8b",
    accentAlt: "#6393d8",
    illustrated: true,
    scientificName: "Pulmones",
    difficulty: "foundation",
    approxBytes: 2_600_000,
    realSizeMm: 250,
    related: ["heart", "brain"],
    metrics: [
      { id: "capacity", value: 6, max: 8, unit: "L", band: [4.5, 6] },
      { id: "rate", value: 14, max: 40, unit: "/min", band: [12, 20] },
      { id: "alveoli", value: 480, max: 600, unit: "×10⁶" },
      { id: "surface", value: 70, max: 120, unit: "m²", band: [50, 75] },
    ],
    hotspots: [
      { id: "trachea", ta: "Trachea", position: [0, 1.6, 0.2], color: AZURE, layer: "duct", weight: 3 },
      { id: "right-lung", ta: "Pulmo dexter", position: [-1.2, 0.1, 0.7], color: CORAL, layer: "surface", weight: 3 },
      { id: "left-lung", ta: "Pulmo sinister", position: [1.2, 0.1, 0.7], color: AMBER, layer: "surface", weight: 3 },
      { id: "bronchus", ta: "Bronchus principalis", position: [-0.03, 0.3, 0.35], color: MAUVE, layer: "duct", weight: 3 },
      { id: "base", ta: "Basis pulmonis", position: [-1.14, -1.2, 1], color: SAGE, layer: "surface", weight: 2 },
      { id: "apex", ta: "Apex pulmonis", position: [1.1, 1.25, 0.5], color: VIOLET, layer: "surface", weight: 2 },
      { id: "hilum", ta: "Hilum pulmonis", position: [0.72, 0.2, 0.2], color: TEAL, layer: "deep", weight: 2 },
      { id: "lobe-fissure", ta: "Fissura obliqua", position: [-1.3, -0.45, 0.55], color: "#c58696", layer: "surface", weight: 1 },
    ],
  },
  {
    id: "liver",
    system: "digestive",
    model: "/models/liver.glb",
    icon: "≈",
    accent: "#b86858",
    accentAlt: "#c69a5e",
    illustrated: true,
    scientificName: "Hepar",
    difficulty: "intermediate",
    approxBytes: 2_400_000,
    realSizeMm: 210,
    related: ["pancreas", "intestine"],
    metrics: [
      { id: "mass", value: 1500, max: 2200, unit: "g", band: [1400, 1800] },
      { id: "flow", value: 1400, max: 2000, unit: "mL/min", band: [1200, 1600] },
      { id: "bile", value: 700, max: 1200, unit: "mL/day", band: [600, 1000] },
      { id: "functions", value: 500, max: 600, unit: "roles" },
    ],
    hotspots: [
      { id: "right-lobe", ta: "Lobus hepatis dexter", position: [-0.75, 0.35, 0.75], color: CORAL, layer: "surface", weight: 3 },
      { id: "left-lobe", ta: "Lobus hepatis sinister", position: [0.85, 0.25, 0.75], color: AMBER, layer: "surface", weight: 3 },
      { id: "portal", ta: "Vena portae hepatis", position: [0.1, -0.3, 0.82], color: AZURE, layer: "vessel", weight: 3 },
      { id: "gallbladder-bed", ta: "Fossa vesicae biliaris", position: [-0.2, -0.75, 0.7], color: SAGE, layer: "deep", weight: 2 },
      { id: "hepatic-artery", ta: "Arteria hepatica propria", position: [0.35, -0.15, 0.7], color: MAUVE, layer: "vessel", weight: 2 },
      { id: "falciform", ta: "Ligamentum falciforme", position: [0.3, 0.85, 0.6], color: VIOLET, layer: "surface", weight: 1 },
    ],
  },
  {
    id: "kidneys",
    system: "urinary",
    model: "/models/kidneys.glb",
    icon: "∞",
    accent: "#c96963",
    accentAlt: "#6bb0b3",
    illustrated: true,
    scientificName: "Renes",
    difficulty: "intermediate",
    approxBytes: 2_100_000,
    realSizeMm: 200,
    related: ["heart", "liver"],
    metrics: [
      { id: "filtrate", value: 180, max: 220, unit: "L/day", band: [150, 190] },
      { id: "gfr", value: 100, max: 140, unit: "mL/min", band: [90, 120] },
      { id: "nephrons", value: 1, max: 1.5, unit: "×10⁶" },
      { id: "output", value: 1.5, max: 3, unit: "L/day", band: [0.8, 2] },
    ],
    hotspots: [
      { id: "cortex", ta: "Cortex renalis", position: [-0.9, 0.55, 0.7], color: CORAL, layer: "surface", weight: 3 },
      { id: "medulla", ta: "Medulla renalis", position: [0.85, 0.2, 0.7], color: AMBER, layer: "deep", weight: 3 },
      { id: "ureter", ta: "Ureter", position: [0.4, -1.1, 0.5], color: AZURE, layer: "duct", weight: 3 },
      { id: "pelvis", ta: "Pelvis renalis", position: [-0.35, -0.35, 0.55], color: MAUVE, layer: "duct", weight: 2 },
      { id: "renal-artery", ta: "Arteria renalis", position: [0.15, 0.65, 0.45], color: SAGE, layer: "vessel", weight: 2 },
      { id: "hilum", ta: "Hilum renale", position: [-0.55, 0.1, 0.4], color: TEAL, layer: "deep", weight: 1 },
    ],
  },
  {
    id: "eyeball",
    system: "sensory",
    model: "/models/eyeball.glb",
    icon: "⊙",
    accent: "#7294b9",
    accentAlt: "#9a86d4",
    illustrated: true,
    scientificName: "Oculus",
    difficulty: "advanced",
    approxBytes: 1_800_000,
    realSizeMm: 24,
    related: ["brain", "skin"],
    metrics: [
      { id: "diameter", value: 24, max: 30, unit: "mm", band: [23, 25] },
      { id: "photoreceptors", value: 126, max: 150, unit: "×10⁶" },
      { id: "pressure", value: 15, max: 30, unit: "mmHg", band: [10, 21] },
      { id: "blink", value: 15, max: 30, unit: "/min", band: [10, 20] },
    ],
    hotspots: [
      { id: "cornea", ta: "Cornea", position: [-0.94, 0.05, 1.47], color: AZURE, layer: "surface", weight: 3 },
      { id: "iris", ta: "Iris", position: [-1.22, -0.53, 1.15], color: AMBER, layer: "surface", weight: 3 },
      { id: "optic", ta: "Nervus opticus", position: [1.61, -0.18, 0.54], color: MAUVE, layer: "nerve", weight: 3 },
      { id: "sclera", ta: "Sclera", position: [0.15, 1.25, 0.95], color: SAGE, layer: "surface", weight: 2 },
      { id: "lens", ta: "Lens", position: [-1.35, 0.1, 0.75], color: TEAL, layer: "deep", weight: 2 },
      { id: "retina", ta: "Retina", position: [1.15, 0.35, 0.85], color: CORAL, layer: "deep", weight: 3 },
    ],
  },
  {
    id: "intestine",
    system: "digestive",
    model: "/models/intestine.glb",
    icon: "§",
    accent: "#d78b77",
    accentAlt: "#7fa88a",
    illustrated: true,
    scientificName: "Intestinum",
    difficulty: "foundation",
    approxBytes: 3_100_000,
    realSizeMm: 320,
    related: ["liver", "pancreas"],
    metrics: [
      { id: "length", value: 7.5, max: 10, unit: "m", band: [6, 9] },
      { id: "surface", value: 30, max: 40, unit: "m²", band: [25, 32] },
      { id: "transit", value: 30, max: 72, unit: "h", band: [24, 48] },
      { id: "microbes", value: 38, max: 50, unit: "×10¹²" },
    ],
    hotspots: [
      { id: "duodenum", ta: "Duodenum", position: [0.6, 0.8, 0.75], color: AMBER, layer: "surface", weight: 3 },
      { id: "jejunum", ta: "Jejunum", position: [-0.45, 0.1, 0.82], color: CORAL, layer: "surface", weight: 3 },
      { id: "colon", ta: "Colon", position: [0.75, -0.55, 0.72], color: AZURE, layer: "surface", weight: 3 },
      { id: "ileum", ta: "Ileum", position: [-0.7, -0.7, 0.8], color: SAGE, layer: "surface", weight: 2 },
      { id: "caecum", ta: "Caecum", position: [-1.15, -1.05, 0.55], color: MAUVE, layer: "surface", weight: 2 },
      { id: "rectum", ta: "Rectum", position: [0.25, -1.55, 0.5], color: VIOLET, layer: "surface", weight: 2 },
      { id: "mesentery", ta: "Mesenterium", position: [0.05, -0.1, 0.35], color: TEAL, layer: "deep", weight: 1 },
    ],
  },
  {
    id: "pancreas",
    system: "endocrine",
    model: "/models/pancreas.glb",
    icon: "◈",
    accent: "#c69a5e",
    accentAlt: "#7fa88a",
    illustrated: true,
    scientificName: "Pancreas",
    difficulty: "advanced",
    approxBytes: 1_700_000,
    realSizeMm: 180,
    related: ["liver", "intestine"],
    metrics: [
      { id: "enzymes", value: 1.5, max: 3, unit: "L/day", band: [1, 2] },
      { id: "islets", value: 1, max: 2, unit: "×10⁶" },
      { id: "insulin", value: 40, max: 100, unit: "U/day", band: [30, 50] },
      { id: "length", value: 18, max: 25, unit: "cm", band: [14, 20] },
    ],
    hotspots: [
      { id: "head", ta: "Caput pancreatis", position: [-1.32, -0.36, 0.55], color: CORAL, layer: "surface", weight: 3 },
      { id: "body", ta: "Corpus pancreatis", position: [0.05, 0.25, 0.45], color: AMBER, layer: "surface", weight: 3 },
      { id: "tail", ta: "Cauda pancreatis", position: [1.55, 0.3, 0.35], color: AZURE, layer: "surface", weight: 3 },
      { id: "duct", ta: "Ductus pancreaticus", position: [-0.61, 0.39, 0.5], color: MAUVE, layer: "duct", weight: 3 },
      { id: "neck", ta: "Collum pancreatis", position: [-0.75, -0.05, 0.5], color: SAGE, layer: "surface", weight: 2 },
      { id: "islets", ta: "Insulae pancreaticae", position: [0.85, 0.15, 0.5], color: VIOLET, layer: "deep", weight: 3 },
    ],
  },
  {
    id: "skin",
    system: "integumentary",
    model: "/models/skin.glb",
    icon: "▦",
    accent: "#c99277",
    accentAlt: "#d89bc4",
    illustrated: true,
    scientificName: "Integumentum commune",
    difficulty: "foundation",
    approxBytes: 2_000_000,
    realSizeMm: 30,
    related: ["brain", "eyeball"],
    metrics: [
      { id: "area", value: 1.8, max: 2.5, unit: "m²", band: [1.5, 2] },
      { id: "mass", value: 4, max: 10, unit: "kg", band: [3.5, 5] },
      { id: "renewal", value: 28, max: 60, unit: "days", band: [25, 45] },
      { id: "receptors", value: 5, max: 10, unit: "×10⁶" },
    ],
    hotspots: [
      { id: "epidermis", ta: "Epidermis", position: [-0.05, 0.88, 1.4], color: CORAL, layer: "surface", weight: 3 },
      { id: "dermis", ta: "Dermis", position: [0.29, 0.05, 1.4], color: AMBER, layer: "deep", weight: 3 },
      { id: "hypodermis", ta: "Tela subcutanea", position: [-0.39, -1.15, 1.4], color: AZURE, layer: "deep", weight: 3 },
      { id: "follicle", ta: "Folliculus pili", position: [0.89, -0.44, 1.4], color: MAUVE, layer: "deep", weight: 3 },
      { id: "sweat-gland", ta: "Glandula sudorifera", position: [-0.95, -0.6, 1.35], color: TEAL, layer: "duct", weight: 2 },
      { id: "nerve-ending", ta: "Corpusculum tactus", position: [0.95, 0.7, 1.35], color: VIOLET, layer: "nerve", weight: 2 },
    ],
  },
];

export const systemStructures: SystemStructure[] = [
  { id: "cardiovascular", icon: "♥", accent: "#ee7c6a", organs: ["heart"] },
  { id: "respiratory", icon: "◍", accent: "#6393d8", organs: ["lungs"] },
  { id: "nervous", icon: "◉", accent: "#9a86d4", organs: ["brain"] },
  { id: "digestive", icon: "≈", accent: "#c69a5e", organs: ["liver", "intestine"] },
  { id: "urinary", icon: "∞", accent: "#6bb0b3", organs: ["kidneys"] },
  { id: "endocrine", icon: "◈", accent: "#d8a24b", organs: ["pancreas"] },
  { id: "sensory", icon: "⊙", accent: "#7294b9", organs: ["eyeball"] },
  { id: "integumentary", icon: "▦", accent: "#c99277", organs: ["skin"] },
];

export const organIds = organStructures.map((organ) => organ.id);
export const systemIds = systemStructures.map((system) => system.id);

export const structureById = Object.fromEntries(
  organStructures.map((organ) => [organ.id, organ]),
) as Record<OrganId, OrganStructure>;

export const systemById = Object.fromEntries(
  systemStructures.map((system) => [system.id, system]),
) as Record<SystemId, SystemStructure>;

/** Total teachable structures — the denominator for mastery percentages. */
export const totalStructures = organStructures.reduce((sum, organ) => sum + organ.hotspots.length, 0);

export function isOrganId(value: string): value is OrganId {
  return Object.hasOwn(structureById, value);
}
