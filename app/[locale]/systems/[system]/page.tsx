import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getLocale, isLocale, localeCodes } from "../../../i18n/config";
import { getDictionary } from "../../../i18n/dictionaries";
import { buildOrgans, buildSystems, indexOrgans } from "../../../i18n/merge";
import { format } from "../../../i18n/types";
import { systemIds, type SystemId } from "../../../lib/anatomy-data";
import { routes, studioLink } from "../../../lib/routes";
import { breadcrumbGraph, pageMetadata, systemPageGraph } from "../../../lib/seo";
import { REVIEWED_DATE } from "../../../lib/content-meta";
import { Breadcrumbs, ReviewedNote, SiteFooter, SiteHeader, StudioCta } from "../../../components/SiteChrome";
import { StructuredData } from "../../../components/StructuredData";
import { AdSlot } from "../../../components/AdSlot";
import { adConfig } from "../../../lib/ads";

type Params = { locale: string; system: string };

export function generateStaticParams() {
  return localeCodes.flatMap((locale) => systemIds.map((system) => ({ locale, system })));
}

async function resolve({ locale, system }: Params) {
  if (!isLocale(locale) || !(systemIds as string[]).includes(system)) return null;
  const dictionary = await getDictionary(locale);
  const organs = buildOrgans(dictionary.organs, dictionary.ui);
  const systems = buildSystems(dictionary.ui);
  const found = systems.find((entry) => entry.id === (system as SystemId));
  if (!found) return null;
  return { config: getLocale(locale), t: dictionary.ui, organs, byId: indexOrgans(organs), system: found };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const resolved = await resolve(await params);
  if (!resolved) return {};
  const { config, t, system } = resolved;

  return pageMetadata({
    locale: config,
    path: `/systems/${system.id}`,
    title: format(t.seo.systemTitle, { system: system.name }),
    description: format(t.seo.systemDescription, {
      role: system.role,
      count: system.organs.length,
      system: system.name,
    }).slice(0, 300),
  });
}

export default async function SystemPage({ params }: { params: Promise<Params> }) {
  const resolved = await resolve(await params);
  if (!resolved) notFound();
  const { config, t, organs, byId, system } = resolved;
  const locale = config.code;
  const ads = adConfig();
  const members = system.organs.map((id) => byId[id]).filter(Boolean);

  const trail = [
    { name: t.site.home, path: routes.studio(locale) },
    { name: t.pages.systemsTitle, path: routes.systems(locale) },
    { name: system.name },
  ];

  return (
    <>
      <StructuredData
        graphs={[
          breadcrumbGraph([
            { name: t.site.home, path: routes.studio(locale) },
            { name: t.pages.systemsTitle, path: routes.systems(locale) },
            { name: system.name, path: routes.system(locale, system.id) },
          ]),
          systemPageGraph({
            locale: config,
            path: routes.system(locale, system.id),
            name: system.name,
            description: system.role,
            organs: members.map((organ) => ({
              name: organ.name,
              latin: organ.scientificName,
              path: routes.organ(locale, organ.id),
            })),
          }),
        ]}
      />

      <SiteHeader locale={config} t={t} />

      <main className="content-page">
        <Breadcrumbs t={t} trail={trail} />

        <article className="article" style={{ "--article-accent": system.accent } as React.CSSProperties}>
          <header className="article-head">
            <p className="article-kicker">
              <span className="hub-glyph inline">{system.icon}</span>
              {format(t.systems.organCount, { count: members.length })}
            </p>
            <h1>{system.name}</h1>
            <p className="article-lead">{system.role}</p>
            {members[0] && <StudioCta t={t} href={studioLink(locale, members[0].id)} />}
          </header>

          <section aria-labelledby="organs">
            <h2 id="organs">{t.pages.organsTitle}</h2>
            <div className="system-organ-list">
              {members.map((organ) => (
                <article key={organ.id} className="system-organ">
                  {organ.illustrated && (
                    <img src={`/anatomy/${organ.id}/thumb.webp`} alt="" width={64} height={64} loading="lazy" decoding="async" />
                  )}
                  <div>
                    <h3><Link href={routes.organ(locale, organ.id)}>{organ.name}</Link></h3>
                    <p className="structure-latin" lang="la">{organ.scientificName}</p>
                    <p>{organ.description}</p>
                    <dl className="inline-facts">
                      <div><dt>{t.info.function}</dt><dd>{organ.function}</dd></div>
                      <div><dt>{t.info.location}</dt><dd>{organ.location}</dd></div>
                      <div><dt>{t.structures.title}</dt><dd>{format(t.structures.count, { count: organ.hotspots.length })}</dd></div>
                    </dl>
                    <Link href={routes.organ(locale, organ.id)} className="text-link">
                      {organ.name} <ArrowRight size={13} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <AdSlot client={ads.client} slot={ads.article} format="inline" label={t.ads.label} />

          <section aria-labelledby="structures">
            <h2 id="structures">{t.article.structures}</h2>
            <ul className="plain-list">
              {members.flatMap((organ) =>
                organ.hotspots.map((hotspot) => (
                  <li key={`${organ.id}-${hotspot.id}`}>
                    <Link href={studioLink(locale, organ.id, hotspot.id)}>{hotspot.label}</Link>
                    <span lang="la"> · {hotspot.ta}</span>
                    <small> — {hotspot.detail}</small>
                  </li>
                )),
              )}
            </ul>
          </section>

          <p className="disclaimer-block">{t.clinical.disclaimer}</p>
          <ReviewedNote t={t} date={REVIEWED_DATE} />
        </article>
      </main>

      <SiteFooter
        locale={config}
        t={t}
        organLinks={organs.map((item) => ({ name: item.name, href: routes.organ(locale, item.id) }))}
      />
    </>
  );
}
