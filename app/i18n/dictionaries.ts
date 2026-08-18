import type { Dictionary, OrganContentDictionary, UiDictionary } from "./types";
import { deepMerge } from "./deep-merge";
import { ui as enUi } from "./ui/en";
import { organs as enOrgans } from "./organs/en";

/** Explicit maps keep each locale in its own chunk while staying statically
 *  analysable by both build pipelines (next build and vinext/Vite). */
const uiLoaders: Record<string, () => Promise<unknown>> = {
  es: () => import("./ui/es").then((m) => m.ui),
  hi: () => import("./ui/hi").then((m) => m.ui),
  zh: () => import("./ui/zh").then((m) => m.ui),
  ar: () => import("./ui/ar").then((m) => m.ui),
  pt: () => import("./ui/pt").then((m) => m.ui),
  fr: () => import("./ui/fr").then((m) => m.ui),
  de: () => import("./ui/de").then((m) => m.ui),
  ja: () => import("./ui/ja").then((m) => m.ui),
  ru: () => import("./ui/ru").then((m) => m.ui),
  id: () => import("./ui/id").then((m) => m.ui),
  ko: () => import("./ui/ko").then((m) => m.ui),
};

const organLoaders: Record<string, () => Promise<unknown>> = {
  es: () => import("./organs/es").then((m) => m.organs),
  hi: () => import("./organs/hi").then((m) => m.organs),
  zh: () => import("./organs/zh").then((m) => m.organs),
  ar: () => import("./organs/ar").then((m) => m.organs),
  pt: () => import("./organs/pt").then((m) => m.organs),
  fr: () => import("./organs/fr").then((m) => m.organs),
  de: () => import("./organs/de").then((m) => m.organs),
  ja: () => import("./organs/ja").then((m) => m.organs),
  ru: () => import("./organs/ru").then((m) => m.organs),
  id: () => import("./organs/id").then((m) => m.organs),
  ko: () => import("./organs/ko").then((m) => m.organs),
};

/**
 * English is the base for every locale. Features ship their copy in `en` first
 * and translations land incrementally without any locale ever rendering a blank
 * label — the merge fills the gaps.
 */
export async function getDictionary(locale: string): Promise<Dictionary> {
  const [uiPatch, organPatch] = await Promise.all([
    uiLoaders[locale]?.() ?? Promise.resolve(undefined),
    organLoaders[locale]?.() ?? Promise.resolve(undefined),
  ]);

  return {
    ui: deepMerge<UiDictionary>(enUi, uiPatch),
    organs: deepMerge<OrganContentDictionary>(enOrgans, organPatch),
  };
}
