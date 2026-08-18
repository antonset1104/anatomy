import type { OrganId, SystemId } from "./anatomy-data";

/**
 * Every URL in one place. The studio used to be the only route, with everything
 * else behind a modal — which meant nothing but the home page could be linked,
 * indexed, or shared. These are the addresses that fixed that, so they are also
 * the ones the sitemap and the breadcrumbs read from.
 */
export const routes = {
  studio: (locale: string) => `/${locale}`,
  organ: (locale: string, organ: OrganId) => `/${locale}/organ/${organ}`,
  systems: (locale: string) => `/${locale}/systems`,
  system: (locale: string, system: SystemId) => `/${locale}/systems/${system}`,
  glossary: (locale: string) => `/${locale}/glossary`,
  lessons: (locale: string) => `/${locale}/lessons`,
  about: (locale: string) => `/${locale}/about`,
  privacy: (locale: string) => `/${locale}/privacy`,
} as const;

/** Opens the studio already focused on a structure — the link an article uses. */
export function studioLink(locale: string, organ: OrganId, hotspot?: string) {
  const params = new URLSearchParams({ o: organ });
  if (hotspot) params.set("h", hotspot);
  return `/${locale}?${params.toString()}`;
}
