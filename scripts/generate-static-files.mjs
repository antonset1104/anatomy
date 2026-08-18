/**
 * Writes `robots.txt`, `sitemap.xml`, and `ads.txt` into `public/` before
 * `vinext build` runs, so they are copied into the static export as ordinary
 * assets.
 *
 * Why this exists instead of Route Handlers: vinext's `output: 'export'`
 * unconditionally classifies every `route.ts` as an API route and skips it —
 * `force-static` has no effect on that decision (see
 * `app/lib/static-files.ts` for the full explanation and the one place the
 * actual file contents are defined). Generating them here, once, at build
 * time keeps the site fully static: no Worker request is spent producing a
 * file that never changes between visitors.
 *
 * Run: npm run build (wired in as a prebuild step) or `npm run seo:generate`
 * on its own to regenerate without a full build.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const PUBLIC_DIR = fileURLToPath(new URL("../public/", import.meta.url));

/**
 * A minimal stand-in for the `.env*` loading `vinext build` does internally.
 * This script runs standalone via `tsx` — outside that pipeline — so without
 * this, `NEXT_PUBLIC_SITE_URL` and the ad env vars silently fall back to their
 * defaults here even on a build that correctly picked them up everywhere else.
 * That is exactly the gap that shipped a first deploy of this site with every
 * page pointing at the right canonical origin except robots.txt and
 * sitemap.xml, which quietly kept advertising the placeholder domain.
 *
 * Precedence matches Next.js: `.env.production.local` > `.env.local` >
 * `.env.production` > `.env`, later files filling in whatever earlier ones
 * did not already set — never overwriting a value the environment already has
 * (e.g. from CI secrets).
 */
async function loadEnvFile(name) {
  let text;
  try {
    text = await readFile(new URL(name, `file://${ROOT}`), "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

// Highest-priority file first: `??=` means whichever file sets a key first
// keeps it, so this order has to run from most to least specific.
for (const name of [".env.production.local", ".env.local", ".env.production", ".env"]) {
  await loadEnvFile(name);
}

const { adsTxt, robotsTxt, sitemapXml } = await import("../app/lib/static-files.ts");

async function write(name, content) {
  const path = `${PUBLIC_DIR}${name}`;
  if (content === null) {
    // Absent on disk is the correct state — e.g. no ads.txt until a publisher
    // id is configured, or no sitemap on a build marked non-indexable. Remove
    // any stale copy from a previous, differently-configured build.
    await rm(path, { force: true });
    console.log(`  ${name}  skipped (not applicable to this build)`);
    return;
  }
  await writeFile(path, content);
  console.log(`  ${name}  ${content.length} bytes`);
}

await mkdir(PUBLIC_DIR, { recursive: true });
console.log("Generating static SEO files:");
await write("robots.txt", robotsTxt());
await write("sitemap.xml", sitemapXml());
await write("ads.txt", adsTxt());
