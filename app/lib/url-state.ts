"use client";

import { isOrganId, type OrganId } from "./anatomy-data";

export type ViewName = "anterior" | "posterior" | "left" | "right" | "superior" | "inferior";

export const viewNames: ViewName[] = ["anterior", "posterior", "left", "right", "superior", "inferior"];

export type DeepLink = { organ: OrganId | null; hotspot: string | null; view: ViewName | null };

function isView(value: string): value is ViewName {
  return (viewNames as string[]).includes(value);
}

/** Reads `?o=heart&h=aorta&v=anterior` — the only URL state the app owns. */
export function readDeepLink(search: string): DeepLink {
  const params = new URLSearchParams(search);
  const organ = params.get("o");
  const view = params.get("v");
  return {
    organ: organ && isOrganId(organ) ? organ : null,
    hotspot: params.get("h"),
    view: view && isView(view) ? view : null,
  };
}

/**
 * Rewrites the query without a navigation, so sharing the current view never
 * costs a re-render of the tree or a model reload.
 */
export function writeDeepLink(link: Partial<DeepLink>) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const entries: [string, string | null | undefined][] = [
    ["o", link.organ],
    ["h", link.hotspot],
    ["v", link.view],
  ];
  for (const [key, value] of entries) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState(null, "", url);
}

export function shareUrl(link: Partial<DeepLink>) {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.search = "";
  if (link.organ) url.searchParams.set("o", link.organ);
  if (link.hotspot) url.searchParams.set("h", link.hotspot);
  if (link.view) url.searchParams.set("v", link.view);
  return url.toString();
}
