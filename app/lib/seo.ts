import type { Metadata } from "next";
import { locales, type LocaleConfig } from "../i18n/config";

/**
 * Absolute URLs for canonicals, og:image, and the sitemap, resolved per host so
 * a preview deployment never advertises another origin's assets — and never
 * competes with production in the index.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://anatomy-atelier.openai.site")
).replace(/\/$/, "");

export const siteName = "Anatomy Atelier";

/**
 * True unless a build opts out. The site is exported once per deployment
 * target rather than rendered per-request, so "is this preview or production"
 * is a build-time question — the deploy that should stay out of the index (a
 * staging environment, a PR preview) is the one that sets this to `"false"`.
 *
 * This used to also check `VERCEL_ENV`, left over from the original template's
 * Vercel-shaped fallbacks. That variable is never set on Cloudflare, so the
 * check silently defaulted to indexable on every build regardless of intent —
 * worth calling out since it is exactly the kind of bug that only shows up
 * once a search engine has already indexed the wrong environment.
 */
export const isIndexable = process.env.NEXT_PUBLIC_ALLOW_INDEXING !== "false";

export function absolute(path: string) {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Every page exists in twelve languages, so each one has to advertise the other
 * eleven. Without this the locales read as duplicates of each other and only one
 * survives in the index.
 */
export function alternatesFor(locale: string, path: string): Metadata["alternates"] {
  const suffix = path === "" ? "" : path.startsWith("/") ? path : `/${path}`;
  return {
    canonical: `/${locale}${suffix}`,
    languages: {
      ...Object.fromEntries(locales.map((entry) => [entry.code, `/${entry.code}${suffix}`])),
      "x-default": `/en${suffix}`,
    },
  };
}

type PageMetaInput = {
  locale: LocaleConfig;
  path: string;
  title: string;
  description: string;
  /** Defaults to the site card. Pass a specimen illustration where one exists. */
  image?: { url: string; alt: string; width?: number; height?: number };
  /** Article pages carry a type of `article`; hubs stay `website`. */
  type?: "website" | "article";
};

/**
 * "Privacy" is a title that means nothing in a result list. Every page gets the
 * site name appended — except the ones whose own title already carries it, where
 * a second copy would just eat the character budget.
 */
function brandedTitle(title: string) {
  return title.includes(siteName) ? title : `${title} · ${siteName}`;
}

export function pageMetadata({ locale, path, title, description, image, type = "website" }: PageMetaInput): Metadata {
  const card = image
    ? { url: image.url, alt: image.alt, width: image.width ?? 1200, height: image.height ?? 675 }
    : { url: "/og.jpg", alt: siteName, width: 1200, height: 675 };
  const full = brandedTitle(title);

  return {
    metadataBase: new URL(siteUrl),
    // `absolute` so no layout-level template can append the brand a second time.
    title: { absolute: full },
    description,
    applicationName: siteName,
    alternates: alternatesFor(locale.code, path),
    robots: isIndexable
      ? { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 }
      : { index: false, follow: false },
    openGraph: {
      type,
      siteName,
      locale: locale.intl,
      alternateLocale: locales.filter((entry) => entry.code !== locale.code).map((entry) => entry.intl),
      url: absolute(`/${locale.code}${path}`),
      title: full,
      description,
      images: [card],
    },
    twitter: { card: "summary_large_image", title: full, description, images: [card] },
  };
}

// ---------------------------------------------------------------- structured data

/**
 * Search engines read JSON-LD, not our CSS. These builders keep the graph in one
 * place so a page cannot describe itself one way to a reader and another way to
 * a crawler.
 */
export type JsonLd = Record<string, unknown>;

export function websiteGraph(locale: LocaleConfig, description: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": absolute("/#website"),
        url: absolute(`/${locale.code}`),
        name: siteName,
        description,
        inLanguage: locale.code,
        publisher: { "@id": absolute("/#publisher") },
      },
      {
        "@type": "Organization",
        "@id": absolute("/#publisher"),
        name: siteName,
        url: absolute("/"),
        logo: { "@type": "ImageObject", url: absolute("/icon-512.png"), width: 512, height: 512 },
      },
    ],
  };
}

export function breadcrumbGraph(trail: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: absolute(entry.path),
    })),
  };
}

/**
 * Anatomy is a medical subject, so the page declares itself as one: the
 * `MedicalWebPage` / `AnatomicalStructure` pair is what tells a crawler this is
 * reference material about a named body part rather than a general article.
 * `lastReviewed` and the audience are the fields that matter most for a
 * health-adjacent page.
 */
export function anatomyPageGraph(input: {
  locale: LocaleConfig;
  path: string;
  name: string;
  latin: string;
  description: string;
  systemName: string;
  bodyLocation: string;
  functions: string;
  conditions: string[];
  parts: { name: string; latin: string; description: string }[];
  image: string;
  reviewed: string;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    "@id": absolute(`${input.path}#page`),
    url: absolute(input.path),
    name: input.name,
    description: input.description,
    inLanguage: input.locale.code,
    lastReviewed: input.reviewed,
    audience: { "@type": "MedicalAudience", audienceType: "Students and general public" },
    isPartOf: { "@id": absolute("/#website") },
    publisher: { "@id": absolute("/#publisher") },
    primaryImageOfPage: { "@type": "ImageObject", url: absolute(input.image) },
    about: {
      "@type": "AnatomicalStructure",
      name: input.name,
      alternateName: input.latin,
      description: input.description,
      bodyLocation: input.bodyLocation,
      function: input.functions,
      partOfSystem: { "@type": "AnatomicalSystem", name: input.systemName },
      relatedCondition: input.conditions.map((condition) => ({ "@type": "MedicalCondition", name: condition })),
      subStructure: input.parts.map((part) => ({
        "@type": "AnatomicalStructure",
        name: part.name,
        alternateName: part.latin,
        description: part.description,
      })),
    },
  };
}

export function systemPageGraph(input: {
  locale: LocaleConfig;
  path: string;
  name: string;
  description: string;
  organs: { name: string; latin: string; path: string }[];
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    "@id": absolute(`${input.path}#page`),
    url: absolute(input.path),
    name: input.name,
    description: input.description,
    inLanguage: input.locale.code,
    isPartOf: { "@id": absolute("/#website") },
    about: {
      "@type": "AnatomicalSystem",
      name: input.name,
      description: input.description,
      comprisedOf: input.organs.map((organ) => ({
        "@type": "AnatomicalStructure",
        name: organ.name,
        alternateName: organ.latin,
        url: absolute(organ.path),
      })),
    },
  };
}

export function collectionGraph(input: {
  locale: LocaleConfig;
  path: string;
  name: string;
  description: string;
  items: { name: string; path: string }[];
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": absolute(`${input.path}#page`),
    url: absolute(input.path),
    name: input.name,
    description: input.description,
    inLanguage: input.locale.code,
    isPartOf: { "@id": absolute("/#website") },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: input.items.length,
      itemListElement: input.items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        url: absolute(item.path),
      })),
    },
  };
}

export function learningResourceGraph(input: {
  locale: LocaleConfig;
  path: string;
  name: string;
  description: string;
  lessons: { name: string; steps: number; path: string }[];
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url: absolute(input.path),
    name: input.name,
    description: input.description,
    inLanguage: input.locale.code,
    isPartOf: { "@id": absolute("/#website") },
    mainEntity: input.lessons.map((lesson) => ({
      "@type": "LearningResource",
      name: lesson.name,
      url: absolute(lesson.path),
      learningResourceType: "Guided tour",
      educationalLevel: "Beginner to intermediate",
      teaches: `${lesson.steps} anatomical structures`,
      inLanguage: input.locale.code,
      isAccessibleForFree: true,
    })),
  };
}
