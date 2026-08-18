import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getLocale, isLocale, localeCodes } from "../../i18n/config";
import { getDictionary } from "../../i18n/dictionaries";
import { buildOrgans, buildSystems, indexOrgans } from "../../i18n/merge";
import { format } from "../../i18n/types";
import { routes } from "../../lib/routes";
import { breadcrumbGraph, collectionGraph, pageMetadata } from "../../lib/seo";
import { Breadcrumbs, SiteFooter, SiteHeader } from "../../components/SiteChrome";
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
    path: "/systems",
    title: ui.pages.systemsTitle,
    description: ui.pages.systemsDescription,
  });
}

export default async function SystemsPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const config = getLocale(locale);
  const { ui: t, organs: content } = await getDictionary(locale);
  const organs = buildOrgans(content, t);
  const byId = indexOrgans(organs);
  const systems = buildSystems(t);
  const ads = adConfig();

  const trail = [
    { name: t.site.home, path: routes.studio(locale) },
    { name: t.pages.systemsTitle },
  ];

  return (
    <>
      <StructuredData
        graphs={[
          breadcrumbGraph([
            { name: t.site.home, path: routes.studio(locale) },
            { name: t.pages.systemsTitle, path: routes.systems(locale) },
          ]),
          collectionGraph({
            locale: config,
            path: routes.systems(locale),
            name: t.pages.systemsTitle,
            description: t.pages.systemsDescription,
            items: systems.map((system) => ({ name: system.name, path: routes.system(locale, system.id) })),
          }),
        ]}
      />

      <SiteHeader locale={config} t={t} />

      <main className="content-page">
        <Breadcrumbs t={t} trail={trail} />

        <header className="page-head">
          <h1>{t.pages.systemsTitle}</h1>
          <p>{t.pages.systemsDescription}</p>
        </header>

        <div className="hub-grid">
          {systems.map((system) => {
            const members = system.organs.map((id) => byId[id]).filter(Boolean);
            return (
              <article key={system.id} className="hub-card" style={{ "--chip-accent": system.accent } as React.CSSProperties}>
                <span className="hub-glyph">{system.icon}</span>
                <h2>
                  <Link href={routes.system(locale, system.id)}>{system.name}</Link>
                </h2>
                <p>{system.role}</p>
                <p className="hub-meta">{format(t.systems.organCount, { count: members.length })}</p>
                <ul className="hub-links">
                  {members.map((organ) => (
                    <li key={organ.id}>
                      <Link href={routes.organ(locale, organ.id)}>
                        {organ.name} <ArrowRight size={12} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <AdSlot client={ads.client} slot={ads.listing} format="leaderboard" label={t.ads.label} />
      </main>

      <SiteFooter
        locale={config}
        t={t}
        organLinks={organs.map((item) => ({ name: item.name, href: routes.organ(locale, item.id) }))}
      />
    </>
  );
}
