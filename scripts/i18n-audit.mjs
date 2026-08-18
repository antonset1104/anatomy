/**
 * Checks the locale dictionaries for the classes of drift TypeScript cannot see.
 *
 * Since locales became patches over English (see `app/i18n/dictionaries.ts`),
 * TypeScript no longer forces every locale to carry every field — a gap is a
 * legitimate state that renders the English string. So the audit's job changed:
 * it now reports *coverage* and hunts for the mistakes that still break a page.
 *
 * Errors — these ship a visibly wrong page:
 *   1. unknown hotspot ids — a typo that will never be read at runtime;
 *   2. unknown metric keys — same, for the physiology labels;
 *   3. placeholder drift — a `{organ}` present in English but dropped in a
 *      translation renders a literal, broken sentence.
 *
 * Warnings — these are just work not yet done:
 *   4. untranslated keys (absent, so English shows through);
 *   5. strings present but identical to English, which is often correct for
 *      anatomical terms and worth a human glance otherwise.
 *
 * Run: npm run i18n:audit
 */
import { organStructures } from "../app/lib/anatomy-data.ts";
import { locales } from "../app/i18n/config.ts";

const RESET = "[0m";
const red = (s) => `[31m${s}${RESET}`;
const yellow = (s) => `[33m${s}${RESET}`;
const green = (s) => `[32m${s}${RESET}`;
const dim = (s) => `[2m${s}${RESET}`;

const placeholders = (value) => (String(value).match(/\{(\w+)\}/g) ?? []).sort().join(",");

/**
 * Depth-first walk yielding [keySegments, string] for every leaf string. The
 * path stays an array rather than a dotted string because some keys contain
 * dots of their own — `metrics["heart.rate"]` is one key, not two levels.
 */
function* strings(node, path = []) {
  for (const [key, value] of Object.entries(node)) {
    const next = [...path, key];
    if (typeof value === "string") yield [next, value];
    else if (value && typeof value === "object" && !Array.isArray(value)) yield* strings(value, next);
  }
}

const at = (node, path) => path.reduce((current, key) => current?.[key], node);

const load = async (locale) => ({
  ui: (await import(`../app/i18n/ui/${locale}.ts`)).ui,
  organs: (await import(`../app/i18n/organs/${locale}.ts`)).organs,
});

const base = await load("en");
const knownHotspots = Object.fromEntries(
  organStructures.map((organ) => [organ.id, organ.hotspots.map((hotspot) => hotspot.id)]),
);
const taByKey = Object.fromEntries(
  organStructures.flatMap((organ) => organ.hotspots.map((h) => [`${organ.id}.${h.id}`, h.ta])),
);
const knownMetricKeys = new Set(
  organStructures.flatMap((organ) => organ.metrics.map((metric) => `${organ.id}.${metric.id}`)),
);

// English is the fallback for everything, so a gap there is a real hole.
for (const organ of organStructures) {
  for (const id of knownHotspots[organ.id]) {
    if (!base.organs[organ.id].hotspots[id]) {
      console.log(red(`  en is missing hotspot ${organ.id}.${id} (${taByKey[`${organ.id}.${id}`]})`));
    }
  }
  for (const metric of organ.metrics) {
    if (!base.ui.metrics[`${organ.id}.${metric.id}`]) {
      console.log(red(`  en is missing metric label ${organ.id}.${metric.id}`));
    }
  }
}

let errors = 0;
const rows = [];
const baseUiStrings = [...strings(base.ui)];

for (const { code } of locales) {
  const dict = await load(code);
  const issues = [];
  let translated = 0;
  let identical = 0;

  // 1 + 4. hotspot keys: unknown ids are typos, absent ids fall back to English.
  for (const organ of organStructures) {
    const want = knownHotspots[organ.id];
    const got = Object.keys(dict.organs[organ.id]?.hotspots ?? {});
    for (const id of got.filter((id) => !want.includes(id))) {
      issues.push(red(`unknown hotspot   ${organ.id}.${id}`));
      errors += 1;
    }
  }

  // 2. metric labels are keyed `<organ>.<metric>`, so a typo is invisible at build.
  for (const key of Object.keys(dict.ui.metrics ?? {})) {
    if (!knownMetricKeys.has(key)) {
      issues.push(red(`unknown metric    metrics.${key}`));
      errors += 1;
    }
  }

  // 3 + 4 + 5. placeholder parity and coverage over the whole UI dictionary.
  for (const [path, english] of baseUiStrings) {
    const value = at(dict.ui, path);
    if (typeof value !== "string") continue;
    translated += 1;
    if (placeholders(english) !== placeholders(value)) {
      issues.push(
        red(`placeholder drift ui.${path.join(".")}  ${dim(`en:[${placeholders(english) || "—"}] ${code}:[${placeholders(value) || "—"}]`)}`),
      );
      errors += 1;
    }
    if (code !== "en" && value === english) identical += 1;
  }

  const coverage = Math.round((translated / baseUiStrings.length) * 100);
  rows.push({ code, coverage, translated, identical, issues });
}

console.log(`\n  locale   ui coverage        same-as-en   status`);
console.log(`  ${"-".repeat(56)}`);
for (const row of rows) {
  const status = row.issues.length ? red(`${row.issues.length} error(s)`) : green("ok");
  const bar = `${row.translated}/${baseUiStrings.length} (${row.coverage}%)`;
  const coverage = row.coverage === 100 ? green(bar) : yellow(bar);
  const same = row.code === "en" ? dim("—") : row.identical ? yellow(String(row.identical)) : green("0");
  console.log(`  ${row.code.padEnd(8)} ${coverage.padEnd(28)} ${same.padEnd(21)} ${status}`);
  for (const issue of row.issues) console.log(`      ${issue}`);
}

console.log(
  `\n  ${errors ? red(`${errors} error(s)`) : green("no errors")}` +
  `  ${dim("gaps fall back to English at runtime — see app/i18n/dictionaries.ts")}\n`,
);
process.exit(errors ? 1 : 0);
