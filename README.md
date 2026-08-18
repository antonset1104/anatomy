# Anatomy Atelier

An interactive 3D human anatomy studio: nine medically detailed specimens you can
rotate, section, isolate, measure, and label — wrapped in guided lessons, three
quiz modes, and a progress record that never leaves the device.

Built on [vinext](https://github.com/cloudflare/vinext) (Next.js 16 on Cloudflare
Workers) with Three.js and GSAP. Twelve locales, right-to-left included.

## Prerequisites

- Node.js `>=22.13.0`

## Quick start

```bash
npm install
npm run dev
```

`npm run build` verifies the vinext build output; `npm test` builds and then runs
the full suite. Every script is cross-platform — no shell-specific env prefixes.

## What is in here

### The specimen stage

`app/lib/three/` owns everything WebGL. It is deliberately not a React tree: the
scene renders on demand, so a still model costs no frames, and the hotspot
callout is positioned imperatively so tracking a spinning specimen never triggers
a re-render.

- **Camera stations** — anterior, posterior, lateral, superior, inferior, tweened
  rather than snapped, plus focus-on-structure that orbits the camera onto the
  axis running out through a chosen dot.
- **Cross-section** — a live clipping plane with a sagittal/transverse/coronal
  selector, a depth slider, and a flip.
- **X-ray, isolate, wireframe** — X-ray keeps the depth prepass attached, which
  is what makes a see-through organ readable instead of a soup of surfaces.
- **Measure** — two clicks on the mesh return a life-size distance in
  millimetres, using each specimen's `realSizeMm`.
- **Labels** — every structure name can be pinned to the model as an in-scene
  sprite, themed light or dark.
- **Capture** — one PNG of the current view, rendered fresh before the read.
- Graceful fallback when WebGL is unavailable: the panels, lessons, and quizzes
  all keep working.

Hotspots are authored as a direction plus a distance and then snapped onto the
mesh shell in one linear pass over the vertices, so a dot never floats inside the
organ or punches through to the far side. `?authoring=1` turns the viewer into a
coordinate probe for placing new ones.

### Learning

- **Guided lessons** — derived from the data rather than authored: teaching
  weight already encodes "look at this first", so a lesson is that ordering made
  walkable, with autoplay, narration, and a cross-specimen grand tour.
- **Quizzes** — three modes. *Label the model* (click the named structure),
  *Name the structure* (read a role, pick from four names), and *Match the roles*.
  Scoped to one specimen or all of them.
- **Progress** — structures learned, specimens opened, quiz history, a study
  streak, and ten milestones. Stored in `localStorage` only; the D1 binding stays
  unused and there is no account.
- **Notes** — per specimen, exportable as Markdown.
- **Glossary** — every labelled structure with its Terminologia Anatomica term.
- **Print** — a study sheet with the facts, the structure list, the conditions,
  and your own notes.

### Interface

- Command palette on `⌘K` / `Ctrl+K` (or `/`) over specimens, structures,
  systems, lessons, and actions.
- Light and dark themes, painted from storage before the first frame so there is
  no flash; plus render quality, text size, reduced motion, and always-on labels.
- Deep links — `?o=heart&h=aorta&v=anterior` reopens the specimen, the structure,
  and the camera angle.
- Side-by-side comparison with two live viewers and linked camera stations.

## SEO and monetisation

The studio is a client app whose entire interface lives behind buttons, so on its
own it gave a crawler exactly one indexable URL per language and no links. The
reference pages exist to fix that: they are server-rendered, ship no WebGL, and
are the site's actual index surface.

### Routes

| Route | Count | What it is |
| --- | --- | --- |
| `/[locale]` | 12 | the 3D studio, plus a server-rendered index of every page |
| `/[locale]/organ/[organ]` | 108 | one article per specimen — facts, every structure, physiology, conditions |
| `/[locale]/systems` | 12 | hub for the eight body systems |
| `/[locale]/systems/[system]` | 96 | one page per system, with its organs and their structures |
| `/[locale]/glossary` | 12 | all 62 structures with TA2 terms, grouped by initial |
| `/[locale]/lessons` | 12 | lesson index with the first steps of each in plain text |
| `/[locale]/about` | 12 | scope, method, terminology, and limits |
| `/[locale]/privacy` | 12 | what is stored, and how ads and analytics are handled |

That is 276 indexable pages, plus `/robots.txt`, `/sitemap.xml`, and `/ads.txt`.

### What each page carries

- A self-referencing canonical, and `hreflang` for all twelve locales plus
  `x-default` — the head tags and the sitemap both, because crawlers use both.
- Exactly one `<h1>`, a branded `<title>`, and a description built from the
  specimen's own copy rather than a keyword template.
- JSON-LD, server-rendered: `MedicalWebPage` wrapping an `AnatomicalStructure`
  (with `partOfSystem`, `relatedCondition`, and every `subStructure`) on organ
  pages, `AnatomicalSystem` on system pages, `CollectionPage` + `ItemList` on the
  hubs, `BreadcrumbList` everywhere, and `WebSite` + `Organization` +
  `WebApplication` on the studio.
- `lastReviewed`, a stated audience, and a visible disclaimer — the fields that
  matter for health-adjacent pages. The review date lives in
  `app/lib/content-meta.ts` and is deliberately hand-maintained: a date that
  moved on every deploy would be a claim nobody had checked.
- Breadcrumbs, related-specimen links, and a footer that links every organ, so no
  page is more than two clicks from any other.

Preview deployments serve `noindex`, `robots.txt` disallows everything, and the
sitemap goes missing entirely — one canonical site, not a dozen competing
copies. Set `NEXT_PUBLIC_SITE_URL` to the real origin; set
`NEXT_PUBLIC_ALLOW_INDEXING=false` on any *other* build (a staging deploy, a PR
preview) to keep it out of the index. All three SEO files are written once, at
build time, by `npm run seo:generate` — see "Hosting" below for why.

### Ads

Nothing is hard-coded and nothing loads by default. Set
`NEXT_PUBLIC_ADSENSE_CLIENT` plus the slot ids (see `.env.example`) and:

- reserved-height containers appear on the content pages — never in the studio,
  where an ad would sit on top of the thing the reader came for;
- the network script is injected once, lazily, when the first slot comes within a
  screen of the viewport, so it is never in front of the page's own LCP;
- `/ads.txt` starts serving, generated from the publisher id rather than
  committed, so the repository never carries someone else's account number.

With the publisher id unset, `AdSlot` renders `null` — not an empty box — so an
unmonetised deployment has no holes in its layout and ships no ad code at all.

### Before applying to an ad network

Two things in this repo are not ready and no amount of markup will fix them:

1. **Article length.** An organ page runs about 330 words of prose around its
   tables and its 3D model. That is thin for a review, and it is thin because the
   prose is generated from the short fields in `app/i18n/organs/*.ts`. Expanding
   `description`, `medical`, and `funFact` — or adding longer fields — lifts every
   locale at once.
2. **Translation coverage.** Ten of the twelve locales fall back to English for
   anything added since the redesign. A page that is half-translated is a weak
   page in that language; consider `noindex` for locales below a coverage bar you
   set, or finish the translations first. `npm run i18n:audit` reports where each
   one stands.

## Layout

```
app/
  [locale]/          route shell and per-locale metadata
  components/        the interface, one concern per file
  lib/
    anatomy-data.ts  structure only — ids, TA terms, positions, colours, metrics
    three/           viewer, hotspot layer, asset manager
    store.ts         persisted progress and preferences
    lessons.ts       lessons derived from teaching weight
    quiz.ts          question generation
  i18n/              locale config, dictionaries, and the merge layer
  styles/            design tokens outwards: tokens → base → layout → …
scripts/             i18n audit and TMS export
tests/               data invariants and server-render checks
```

### Data and translation

`app/lib/anatomy-data.ts` holds no prose. Every organ and structure is identified
by a stable id plus its Terminologia Anatomica term, which is the key locale files
translate against — so a reviewer can check a label against the international
standard instead of guessing from the English.

Locales are **patches over English** (`app/i18n/dictionaries.ts`). A locale ships
what it has translated and the English dictionary is merged underneath, so a new
feature never renders a blank label in eleven languages, and a translation can
land one section at a time. `npm run i18n:audit` reports coverage per locale and
fails on the mistakes that still break a page — unknown structure ids, unknown
metric keys, and placeholder drift. `npm run i18n:export` flattens the
dictionaries for a TMS, with the Latin anchor attached as translator context.

Currently complete: English and Indonesian. The other ten carry the original
copy and fall back to English for everything added since.

## Commands

- `npm run dev` — local development
- `npm run build` — verify the vinext build output
- `npm test` — build, then data invariants and server-render checks
- `npm run test:unit` — data invariants only, no build
- `npm run lint` — eslint
- `npm run i18n:audit` — locale coverage and drift
- `npm run i18n:export` — dictionaries as JSON for translators
- `npm run db:generate` — Drizzle migrations, if a database is ever added

- `npm run seo:generate` — regenerate `robots.txt` / `sitemap.xml` / `ads.txt`
  without a full build

Configuration lives in `.env.example`; copy it to `.env.local` to set the
canonical origin and switch on ads. Because the site is a static export (see
"Hosting" below), these values are baked into the HTML at build time — changing
`NEXT_PUBLIC_SITE_URL` or the ad ids needs a rebuild and redeploy, not just a
new environment variable on a running server.

## Hosting: a static export, and why

Every page is enumerable at build time — twelve locales times a fixed set of
organs, systems, and hub pages, all listed by `generateStaticParams`, with zero
per-request personalisation anywhere (progress, theme, and bookmarks all live in
the browser's own `localStorage`). `next.config.ts` sets `output: "export"` for
exactly that reason: the whole site becomes plain HTML files, and `vinext build`
pre-renders all ~276 pages into `dist/client/` rather than rendering any of them
on demand.

This matters specifically for Cloudflare's **Workers Free plan** (100,000
requests/day, roughly 10ms CPU time per request, at the time of writing — check
Cloudflare's current pricing page, these do change). Cloudflare serves a static
asset directly from its edge network without invoking the Worker script at
all — so once exported, ordinary page views cost nothing against either limit,
no matter how much traffic the SEO work brings in. Before this, every single
page view re-rendered the page from scratch on every request (vinext's own
description of its default behaviour, confirmed by the build output marking
every route dynamic), which would have made the free plan's ceiling a real risk
exactly when the site started getting the traffic it was built for.

`worker/index.ts` still exists, but does almost nothing: a static export has no
`app/page.tsx` at the bare root for `/` to resolve to, and `redirects()` needs a
live server to evaluate (which a static export does not have), so the one
redirect the site needs — `/` → `/en` — is hand-written there. Every other
request falls through to `env.ASSETS.fetch()`, Cloudflare's own static file
server; for a URL that matches one of the exported pages, the platform answers
it before the Worker script runs at all.

Two things worth knowing if you touch this:

- **`route.ts` files do not survive a static export under vinext.** Its build
  classifies every Route Handler as an API route and skips it unconditionally —
  `export const dynamic = "force-static"` has no effect on that decision. That
  is why `robots.txt`, `sitemap.xml`, and `ads.txt` are plain functions in
  `app/lib/static-files.ts`, written to `public/` by
  `scripts/generate-static-files.mjs` (wired into `npm run build`) instead of
  living under `app/` as routes.
- **A custom root `app/not-found.tsx` currently breaks the export.** Tried and
  reverted during this work — even a minimal, synchronous version made
  `vinext build` silently drop `404.html` from the output entirely. The site
  ships vinext's plain default 404 instead. Since 404 pages carry no SEO weight,
  this was judged not worth chasing further; worth retrying on a newer vinext
  release if a branded 404 page matters to you.

Nothing else about the app depends on a live server, so none of this trades away
functionality — it just moves when the rendering work happens.

## Known issues

- On Windows, `next/font/google` under vinext emits absolute `file:///C:/…` URLs
  for the woff2 files, so the web fonts fail to load in dev and the CSS font
  stack is used instead. This is a toolchain issue, not an app one; macOS and
  Linux are unaffected.

## Notes on the platform

This app needs no database. `.openai/hosting.json` declares optional Sites D1 and
R2 bindings, `vite.config.ts` simulates declared bindings locally, and
`examples/d1/` keeps an opt-in D1 surface for reference — none of it is wired
into the app.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection; `app/chatgpt-auth.ts` has the
helpers if a future account-backed feature needs them. Nothing in the app is
behind sign-in today.

## Learn more

- [vinext documentation](https://github.com/cloudflare/vinext)
- [Three.js](https://threejs.org/docs/)
- [Terminologia Anatomica](https://ta2viewer.openanatomy.org/)
