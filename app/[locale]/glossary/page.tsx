import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, isLocale, localeCodes } from "../../i18n/config";
import { getDictionary } from "../../i18n/dictionaries";
import { buildGlossary, buildOrgans } from "../../i18n/merge";
import { format } from "../../i18n/types";
import { routes, studioLink } from "../../lib/routes";
import { breadcrumbGraph, collectionGraph, pageMetadata } from "../../lib/seo";
import { REVIEWED_DATE } from "../../lib/content-meta";
import { Breadcrumbs, ReviewedNote, SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { StructuredData } from "../../components/StructuredData";
import { AdSlot } from "../../components/AdSlot";
import { adConfig } from "../../lib/ads";

type Params = { locale: string };

export function generateStaticParams() {
  return localeCodes.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { ui } = await getDictionary(locale);
  return pageMetadata({
    locale: getLocale(locale),
    path: "/glossary",
    title: ui.pages.glossaryTitle,
    description: ui.pages.glossaryDescription,
  });
}

export default async function GlossaryPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const config = getLocale(locale);
  const { ui: t, organs: content } = await getDictionary(locale);
  const organs = buildOrgans(content, t);
  const entries = buildGlossary(organs);
  const ads = adConfig();

  const trail = [
    { name: t.site.home, path: routes.studio(locale) },
    { name: t.pages.glossaryTitle },
  ];

  // Grouped by initial letter so the page has scannable internal structure
  // rather than one 62-row wall — and so each group gets its own heading.
  const groups = new Map<string, typeof entries>();
  for (const entry of entries) {
    const initial = entry.hotspot.label.slice(0, 1).toLocaleUpperCase(locale);
    const bucket = groups.get(initial) ?? [];
    bucket.push(entry);
    groups.set(initial, bucket);
  }

  return (
    <>
      <StructuredData
        graphs={[
          breadcrumbGraph([
            { name: t.site.home, path: routes.studio(locale) },
            { name: t.pages.glossaryTitle, path: routes.glossary(locale) },
          ]),
          collectionGraph({
            locale: config,
            path: routes.glossary(locale),
            name: t.pages.glossaryTitle,
            description: t.pages.glossaryDescription,
            items: entries.map((entry) => ({
              name: entry.hotspot.label,
              path: studioLink(locale, entry.organ.id, entry.hotspot.id),
            })),
          }),
        ]}
      />

      <SiteHeader locale={config} t={t} />

      <main className="content-page">
        <Breadcrumbs t={t} trail={trail} />

        <header className="page-head">
          <h1>{t.pages.glossaryTitle}</h1>
          <p>{t.pages.glossaryDescription}</p>
          <p className="hub-meta">{format(t.article.structureCount, { count: entries.length })}</p>
        </header>

        <AdSlot client={ads.client} slot={ads.listing} format="leaderboard" label={t.ads.label} />

        {[...groups.entries()].map(([initial, group]) => (
          <section key={initial} className="glossary-group" aria-labelledby={`letter-${initial}`}>
            <h2 id={`letter-${initial}`}>{initial}</h2>
            <dl className="glossary-list">
              {group.map(({ organ, hotspot }) => (
                <div key={`${organ.id}-${hotspot.id}`} style={{ "--dot": hotspot.color } as React.CSSProperties}>
                  <dt>
                    <Link href={studioLink(locale, organ.id, hotspot.id)}>{hotspot.label}</Link>
                    <i lang="la">{hotspot.ta}</i>
                  </dt>
                  <dd>
                    {hotspot.detail}
                    <span className="glossary-organ">
                      <Link href={routes.organ(locale, organ.id)}>{organ.name}</Link>
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        <ReviewedNote t={t} date={REVIEWED_DATE} />
      </main>

      <SiteFooter
        locale={config}
        t={t}
        organLinks={organs.map((item) => ({ name: item.name, href: routes.organ(locale, item.id) }))}
      />
    </>
  );
}
