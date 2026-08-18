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
import { mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { adsTxt, robotsTxt, sitemapXml } from "../app/lib/static-files.ts";

const PUBLIC_DIR = fileURLToPath(new URL("../public/", import.meta.url));

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
