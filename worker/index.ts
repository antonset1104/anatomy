/**
 * Cloudflare Worker entry point.
 *
 * The site is a static export (see `next.config.ts`) — every page is a
 * pre-rendered HTML file. For an actual visitor, Cloudflare serves those files
 * directly from its static asset edge network; this script's `fetch()` never
 * runs for them at all. That is what makes the Workers Free plan's request and
 * CPU-time limits a non-issue here regardless of how much traffic the SEO work
 * brings in.
 *
 * Two things this script is still responsible for:
 *
 *  1. Redirecting `/` to the default locale — there is no `app/page.tsx` at the
 *     root for a static export to produce, so the one thing `redirects()` used
 *     to handle in `next.config.ts` (which needs a live server to evaluate, and
 *     so doesn't work under `output: 'export'`) is handled here instead.
 *  2. `handler.fetch()` as the fallback for everything else. This is not dead
 *     weight kept "just in case" — vinext's own build tooling reuses this exact
 *     bundled entry point to drive the static export itself, calling internal
 *     `/__vinext/prerender/*` control routes to run `generateStaticParams` and
 *     render each page to HTML. Replacing this fallback with a plain asset
 *     fetch breaks `vinext build`, not just some hypothetical edge case.
 */
import handler from "vinext/server/app-router-entry";
import { defaultLocale } from "../app/i18n/config";

interface Env {
  ASSETS: Fetcher;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      url.pathname = `/${defaultLocale}`;
      return Response.redirect(url, 302);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
