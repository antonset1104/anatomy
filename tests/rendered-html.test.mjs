/**
 * Server-render checks against the built worker. These run on `dist/`, so they
 * catch the failures a type-check cannot: a client component imported into the
 * RSC graph, a dictionary that throws during render, a locale that 404s.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { localeCodes } from "../app/i18n/config.ts";

async function render(path) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("sends bare visits to the default locale", async () => {
  const response = await render("/");
  assert.ok(
    [301, 302, 307, 308].includes(response.status),
    `expected a redirect from /, got ${response.status}`,
  );
  // The static export has no `redirects()` support to fall back on (see
  // `next.config.ts`), so this one redirect is hand-written in
  // `worker/index.ts` as an absolute URL — hence checking the pathname rather
  // than an exact string match against a relative one.
  assert.equal(new URL(response.headers.get("location")).pathname, "/en");
});

test("server-renders the English workspace", async () => {
  const response = await render("/en");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="en"/);
  assert.match(html, /<title>Anatomy Atelier[^<]*<\/title>/i);

  // The shell, not just a loading state: the default specimen and its panels
  // have to be in the markup before any JavaScript runs.
  assert.match(html, /Heart/);
  assert.match(html, /Cor/);
  assert.match(html, /Left Ventricle/);
  assert.match(html, /Cardiovascular/);

  // Chrome that the redesign depends on.
  // The theme is painted from storage before the first frame, so the bootstrap
  // has to be inline in <head> rather than deferred with the bundle.
  assert.match(html, /root\.dataset\.theme = theme/, "expected the no-flash theme bootstrap");
  assert.match(html, /anatomy-atelier:v2/);
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /Skip to the specimen viewer/);
  assert.match(html, /role="dialog"|aria-label="3D viewer tools"/);
});

test("server-renders a translated locale in its own script and direction", async () => {
  const response = await render("/id");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="id"/);
  assert.match(html, /Jantung/);
  assert.match(html, /Belajar anatomi seperti seorang seniman/);
  // Structures added after the Indonesian translation landed still resolve,
  // because English is merged underneath.
  assert.match(html, /Trunkus pulmonalis/);
});

test("renders right-to-left locales with dir=rtl", async () => {
  const response = await render("/ar");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<html[^>]*dir="rtl"/);
});

test("every configured locale renders", async () => {
  for (const locale of localeCodes) {
    const response = await render(`/${locale}`);
    assert.equal(response.status, 200, `/${locale} returned ${response.status}`);
    const html = await response.text();
    assert.match(html, new RegExp(`<html[^>]*lang="${locale}"`), `/${locale} rendered the wrong lang`);
  }
});

test("rejects a locale that is not configured", async () => {
  const response = await render("/xx");
  assert.equal(response.status, 404);
});
