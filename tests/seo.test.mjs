/**
 * SEO checks against the built site.
 *
 * The site is a static export (see `next.config.ts`): every page is a
 * pre-rendered HTML file under `dist/client/`, which is exactly what a real
 * visitor and a real crawler receive from Cloudflare — so most of these tests
 * read that content by asking the Worker to render it (`handler.fetch()`
 * keeps working live even after an export build, which is convenient for
 * testing arbitrary paths without enumerating every file on disk).
 *
 * Three files are different: `robots.txt`, `sitemap.xml`, and `ads.txt` are
 * written straight to `public/` at build time by
 * `scripts/generate-static-files.mjs`, because vinext's `output: 'export'`
 * unconditionally skips `route.ts` handlers (see `app/lib/static-files.ts`
 * for why). There is no route left to fetch for them — they only exist as
 * files in `dist/client/`, so those three tests read the filesystem directly
 * instead of going through the Worker.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { localeCodes, locales } from "../app/i18n/config.ts";
import { organIds, systemIds } from "../app/lib/anatomy-data.ts";

const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "https://anatomy.vijeron.com";
const CLIENT_DIR = new URL("../dist/client/", import.meta.url);

async function fetchPath(path) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

/** Reads a file written straight into `dist/client/` — `null` if it is absent,
 *  which for `ads.txt` and an unindexable `sitemap.xml`/`robots.txt` is the
 *  correct, deliberate state rather than a build failure. */
async function readStaticFile(name) {
  try {
    return await readFile(new URL(name, CLIENT_DIR), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function html(path) {
  const response = await fetchPath(path);
  assert.equal(response.status, 200, `${path} returned ${response.status}`);
  return response.text();
}

/** Every JSON-LD block on the page, parsed. */
function jsonLd(markup) {
  const blocks = [...markup.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)];
  return blocks.map((match) => JSON.parse(match[1].replace(/\\u003c/g, "<")));
}

function types(graphs) {
  return graphs.flatMap((graph) =>
    Array.isArray(graph["@graph"]) ? graph["@graph"].map((node) => node["@type"]) : [graph["@type"]],
  );
}

const CONTENT_PATHS = [
  "/en",
  "/en/organ/heart",
  "/en/systems",
  "/en/systems/cardiovascular",
  "/en/glossary",
  "/en/lessons",
  "/en/about",
  "/en/privacy",
];

test("every page declares a canonical that points at itself", async () => {
  for (const path of CONTENT_PATHS) {
    const markup = await html(path);
    const canonical = markup.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    assert.equal(canonical, `${ORIGIN}${path}`, `${path} has the wrong canonical`);
  }
});

test("every page offers all twelve translations plus x-default", async () => {
  for (const path of ["/en", "/en/organ/heart", "/en/systems/cardiovascular", "/en/glossary"]) {
    const markup = await html(path);
    for (const locale of locales) {
      const expected = `${ORIGIN}${path.replace("/en", `/${locale.code}`)}`;
      assert.ok(
        markup.includes(`hrefLang="${locale.code}" href="${expected}"`) ||
          markup.includes(`hreflang="${locale.code}" href="${expected}"`),
        `${path} is missing an alternate for ${locale.code}`,
      );
    }
    assert.match(markup, /hrefLang="x-default"|hreflang="x-default"/, `${path} is missing x-default`);
  }
});

test("every page has exactly one h1, a title, and a description", async () => {
  for (const path of CONTENT_PATHS) {
    const markup = await html(path);
    const headings = markup.match(/<h1[\s>]/g) ?? [];
    assert.equal(headings.length, 1, `${path} has ${headings.length} h1 elements`);

    const title = markup.match(/<title>([^<]+)<\/title>/)?.[1] ?? "";
    assert.ok(title.length > 10 && title.length <= 90, `${path} has an unusable title: "${title}"`);

    const description = markup.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
    assert.ok(description.length > 50, `${path} description is too short: "${description}"`);
    assert.ok(description.length <= 320, `${path} description is too long (${description.length})`);
  }
});

test("pages allow indexing and large image previews", async () => {
  const markup = await html("/en/organ/heart");
  const robots = markup.match(/<meta name="robots" content="([^"]+)"/)?.[1] ?? "";
  assert.match(robots, /index/);
  assert.match(robots, /max-image-preview:large/);
});

test("organ pages describe themselves as medical reference material", async () => {
  const markup = await html("/en/organ/heart");
  const graphs = jsonLd(markup);
  assert.ok(graphs.length >= 2, "expected breadcrumbs and a page graph");
  assert.ok(types(graphs).includes("MedicalWebPage"));
  assert.ok(types(graphs).includes("BreadcrumbList"));

  const page = graphs.find((graph) => graph["@type"] === "MedicalWebPage");
  assert.equal(page.about["@type"], "AnatomicalStructure");
  assert.equal(page.about.alternateName, "Cor");
  assert.equal(page.about.partOfSystem["@type"], "AnatomicalSystem");
  assert.ok(page.about.subStructure.length >= 10, "every labelled structure should be declared");
  assert.ok(page.about.relatedCondition.length > 0);
  assert.match(page.lastReviewed, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(page.inLanguage, "en");

  const crumbs = graphs.find((graph) => graph["@type"] === "BreadcrumbList");
  assert.deepEqual(
    crumbs.itemListElement.map((item) => item.position),
    [1, 2, 3, 4],
  );
});

test("the studio page carries the site graph and a crawlable index", async () => {
  const markup = await html("/en");
  assert.ok(types(jsonLd(markup)).includes("WebSite"));
  assert.ok(types(jsonLd(markup)).includes("Organization"));
  assert.ok(types(jsonLd(markup)).includes("WebApplication"));

  // The studio's own interface is all buttons, so these server-rendered links
  // are the only path a crawler has from the root into the reference pages.
  for (const organ of organIds) {
    assert.ok(markup.includes(`/en/organ/${organ}`), `the home page does not link to ${organ}`);
  }
  for (const system of systemIds) {
    assert.ok(markup.includes(`/en/systems/${system}`), `the home page does not link to ${system}`);
  }
  assert.ok(markup.includes("/en/glossary"));
  assert.ok(markup.includes("/en/privacy"));
});

test("system and collection pages declare their members", async () => {
  const system = jsonLd(await html("/en/systems/cardiovascular"));
  const systemPage = system.find((graph) => graph["@type"] === "MedicalWebPage");
  assert.equal(systemPage.about["@type"], "AnatomicalSystem");
  assert.ok(systemPage.about.comprisedOf.length > 0);

  const glossary = jsonLd(await html("/en/glossary"));
  const collection = glossary.find((graph) => graph["@type"] === "CollectionPage");
  assert.equal(collection.mainEntity["@type"], "ItemList");
  assert.equal(collection.mainEntity.numberOfItems, collection.mainEntity.itemListElement.length);
  assert.ok(collection.mainEntity.numberOfItems >= 60);
});

test("article pages include the configured AdSense script", async () => {
  const markup = await html("/en/organ/heart");
  assert.match(markup, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-6180580801533680/);
});

test("robots.txt allows crawling and points at the sitemap", async () => {
  const body = await readStaticFile("robots.txt");
  assert.ok(body, "robots.txt should exist in an indexable build");
  assert.match(body, /^User-agent: \*/m);
  assert.match(body, /^Allow: \//m);
  assert.equal(body.match(/^Sitemap: (.+)$/m)?.[1], `${ORIGIN}/sitemap.xml`);
});

test("the sitemap lists every page in every locale with its alternates", async () => {
  const body = await readStaticFile("sitemap.xml");
  assert.ok(body, "sitemap.xml should exist in an indexable build");

  const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  // 6 fixed pages + 9 organs + 8 systems, once per locale.
  const perLocale = 6 + organIds.length + systemIds.length;
  assert.equal(locs.length, perLocale * localeCodes.length);
  assert.equal(new Set(locs).size, locs.length, "the sitemap repeats a URL");

  for (const organ of organIds) {
    assert.ok(locs.includes(`${ORIGIN}/en/organ/${organ}`), `sitemap is missing ${organ}`);
    assert.ok(locs.includes(`${ORIGIN}/id/organ/${organ}`), `sitemap is missing the Indonesian ${organ}`);
  }
  assert.ok(locs.includes(`${ORIGIN}/en`));
  assert.ok(locs.includes(`${ORIGIN}/en/privacy`));

  // Alternates are what stop twelve languages reading as twelve duplicates.
  assert.match(body, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
  assert.match(body, /hreflang="x-default"/);
  const alternates = [...body.matchAll(/<xhtml:link /g)];
  assert.equal(alternates.length, locs.length * (localeCodes.length + 1));
});

test("ads.txt contains configured AdSense publisher ID", async () => {
  const body = await readStaticFile("ads.txt");
  assert.match(body ?? "", /google\.com, pub-6180580801533680, DIRECT, f08c47fec0942fa0/);
});

test("translated pages localise their own metadata", async () => {
  const markup = await html("/id/organ/heart");
  assert.match(markup, /<html[^>]*lang="id"/);
  assert.match(markup, /<title>Anatomi Jantung/);
  assert.equal(markup.match(/<link rel="canonical" href="([^"]+)"/)?.[1], `${ORIGIN}/id/organ/heart`);

  const page = jsonLd(markup).find((graph) => graph["@type"] === "MedicalWebPage");
  assert.equal(page.inLanguage, "id");
  assert.equal(page.name, "Jantung");
  // The Latin anchor is the same in every language — that is the point of it.
  assert.equal(page.about.alternateName, "Cor");
});

test("every organ and system page renders in every locale", async () => {
  for (const locale of localeCodes) {
    const organ = await fetchPath(`/${locale}/organ/heart`);
    assert.equal(organ.status, 200, `/${locale}/organ/heart returned ${organ.status}`);
    const system = await fetchPath(`/${locale}/systems/cardiovascular`);
    assert.equal(system.status, 200, `/${locale}/systems/cardiovascular returned ${system.status}`);
  }
});

test("unknown organs and systems 404 rather than rendering an empty page", async () => {
  assert.equal((await fetchPath("/en/organ/spleen")).status, 404);
  assert.equal((await fetchPath("/en/systems/lymphatic")).status, 404);
});

// ------------------------------------------------------- static export shape

/**
 * These read `dist/client/` directly rather than going through the Worker,
 * because they exist specifically to prove the thing a real Cloudflare
 * deployment actually serves: on the real site, a request for one of these
 * paths never reaches the Worker's `fetch()` at all — Cloudflare's static
 * asset routing answers it first. `handler.fetch()` staying functional after
 * an export build (as the tests above rely on) is a convenience for testing,
 * not what production traffic hits.
 */

test("the Worker redirects the bare domain to the default locale", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/"),
    { ASSETS: { fetch: async () => new Response("should not be reached", { status: 500 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 302);
  assert.equal(new URL(response.headers.get("location")).pathname, "/en");
});

test("every locale, organ, and system page exists as a static HTML file", async () => {
  for (const locale of localeCodes) {
    await readFile(new URL(`${locale}.html`, CLIENT_DIR), "utf8");
    for (const page of ["about", "glossary", "lessons", "privacy", "systems"]) {
      await readFile(new URL(`${locale}/${page}.html`, CLIENT_DIR), "utf8");
    }
    for (const organ of organIds) {
      await readFile(new URL(`${locale}/organ/${organ}.html`, CLIENT_DIR), "utf8");
    }
    for (const system of systemIds) {
      await readFile(new URL(`${locale}/systems/${system}.html`, CLIENT_DIR), "utf8");
    }
  }
});

test("the exported studio page needs no server to render its content", async () => {
  // Read straight from disk, with no Worker involved at all — this is the file
  // Cloudflare hands to a visitor. If the specimen name and the 3D canvas mount
  // point aren't in it, the export produced an empty shell.
  const markup = await readFile(new URL("en.html", CLIENT_DIR), "utf8");
  assert.match(markup, />Heart</);
  assert.match(markup, /three-mount/);
  assert.match(markup, /anatomy-atelier:v2/, "expected the no-flash theme bootstrap");
});
