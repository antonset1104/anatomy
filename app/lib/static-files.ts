import { localeCodes, locales } from "../i18n/config";
import { organIds, systemIds } from "./anatomy-data";
import { REVIEWED_DATE } from "./content-meta";
import { absolute, isIndexable } from "./seo";

/**
 * Content for the three crawler-facing files (`robots.txt`, `sitemap.xml`,
 * `ads.txt`), as pure functions rather than Route Handlers.
 *
 * vinext currently skips every `route.ts` unconditionally under
 * `output: 'export'` — `force-static` has no effect on that decision, it is
 * classified `type: "api"` before the file is even read. Since this site is a
 * fully static export (see `next.config.ts`), these three files are written to
 * `public/` at build time by `scripts/generate-static-files.mjs` instead, so
 * they end up as ordinary static assets alongside everything else.
 *
 * The logic lives here rather than in that script so there is exactly one
 * definition of what each file contains — the generator script and, if a
 * future vinext release lifts the route.ts restriction, a Route Handler would
 * both just call these.
 */

export function robotsTxt(): string {
  if (!isIndexable) {
    return ["User-agent: *", "Disallow: /", ""].join("\n");
  }

  return [
    "User-agent: *",
    "Allow: /",
    "",
    // The studio reads its state from the query string. Those URLs render the
    // same specimen an article already covers, so they are crawlable but not
    // worth having as separate entries.
    "Disallow: /*?*authoring=",
    "",
    `Sitemap: ${absolute("/sitemap.xml")}`,
    "",
  ].join("\n");
}

type SitemapEntry = { path: (locale: string) => string; priority: number; changefreq: string };

const SITEMAP_ENTRIES: SitemapEntry[] = [
  { path: (locale) => `/${locale}`, priority: 1.0, changefreq: "weekly" },
  { path: (locale) => `/${locale}/systems`, priority: 0.8, changefreq: "monthly" },
  { path: (locale) => `/${locale}/glossary`, priority: 0.8, changefreq: "monthly" },
  { path: (locale) => `/${locale}/lessons`, priority: 0.7, changefreq: "monthly" },
  { path: (locale) => `/${locale}/about`, priority: 0.4, changefreq: "yearly" },
  { path: (locale) => `/${locale}/privacy`, priority: 0.2, changefreq: "yearly" },
  ...organIds.map((organ) => ({
    path: (locale: string) => `/${locale}/organ/${organ}`,
    priority: 0.9,
    changefreq: "monthly",
  })),
  ...systemIds.map((system) => ({
    path: (locale: string) => `/${locale}/systems/${system}`,
    priority: 0.7,
    changefreq: "monthly",
  })),
];

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Every URL declares its eleven translations with `xhtml:link` alternates.
 * That is what stops the locales from being read as duplicates — the same job
 * the `hreflang` tags do in the head, repeated here because crawlers use both.
 *
 * Returns `null` when the build is not indexable, matching the Route Handler
 * this replaced: a non-production build should not hand a crawler a list of
 * URLs to go index.
 */
export function sitemapXml(): string | null {
  if (!isIndexable) return null;

  const urls = SITEMAP_ENTRIES.flatMap((entry) =>
    localeCodes.map((locale) => {
      const alternates = locales
        .map(
          (other) =>
            `    <xhtml:link rel="alternate" hreflang="${other.code}" href="${escapeXml(absolute(entry.path(other.code)))}"/>`,
        )
        .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(absolute(entry.path("en")))}"/>`)
        .join("\n");

      return [
        "  <url>",
        `    <loc>${escapeXml(absolute(entry.path(locale)))}</loc>`,
        `    <lastmod>${REVIEWED_DATE}</lastmod>`,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority.toFixed(1)}</priority>`,
        alternates,
        "  </url>",
      ].join("\n");
    }),
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

/** Google's fixed AdSense/AdX certification authority id. */
const GOOGLE_TAG_ID = "f08c47fec0942fa0";

/**
 * Returns `null` — meaning "do not write this file" — until a publisher id is
 * configured. An absent `ads.txt` and a 404 for it are the same signal to an ad
 * exchange: this site sells nothing (yet).
 */
export function adsTxt(): string | null {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  // AdSense ids arrive as `ca-pub-…`; ads.txt wants the bare publisher id.
  const publisherId = client?.replace(/^ca-/, "").trim();
  if (!publisherId || !/^pub-\d{10,20}$/.test(publisherId)) return null;

  const lines = [`google.com, ${publisherId}, DIRECT, ${GOOGLE_TAG_ID}`];

  // Any additional sellers — an ad manager, a mediation partner — as a
  // comma-separated list of complete ads.txt records.
  const extra = process.env.ADS_TXT_EXTRA_RECORDS;
  if (extra) {
    lines.push(...extra.split(/[\n,](?=\s*[a-z0-9.-]+\s*,)/i).map((line) => line.trim()).filter(Boolean));
  }

  return `${lines.join("\n")}\n`;
}
