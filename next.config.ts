import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Every page is known at build time — twelve locales times a fixed set of
   * organs, systems, and hub pages, all enumerated via `generateStaticParams`,
   * with no per-request personalisation anywhere (progress, theme, and
   * bookmarks all live in the browser's own localStorage). That combination is
   * exactly what static export is for: the whole site becomes HTML files
   * served directly from Cloudflare's edge, with no Worker invocation and no
   * CPU time spent per visit. On the Workers Free plan — 100k requests/day,
   * ~10ms CPU per request — that is the difference between "fine for a hobby
   * site" and "fine no matter how much the SEO work pays off".
   *
   * `redirects()` is intentionally not used here: it requires a server to
   * evaluate on each request, which a static export does not have. The single
   * redirect this app needs (`/` → `/en`) is handled by the Cloudflare Worker
   * in `worker/index.ts` instead — the one request in the whole site that
   * still touches a Worker.
   */
  output: "export",
};

export default nextConfig;
