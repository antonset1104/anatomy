import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getLocale, isLocale, localeCodes } from "../../../i18n/config";
import { getDictionary } from "../../../i18n/dictionaries";
import { buildOrgans, buildSystems, indexOrgans } from "../../../i18n/merge";
import { format } from "../../../i18n/types";
import { isOrganId, organIds, type OrganId } from "../../../lib/anatomy-data";
import { routes, studioLink } from "../../../lib/routes";
import { anatomyPageGraph, breadcrumbGraph, pageMetadata } from "../../../lib/seo";
import { REVIEWED_DATE } from "../../../lib/content-meta";
import { Breadcrumbs, ReviewedNote, SiteFooter, SiteHeader, StudioCta } from "../../../components/SiteChrome";
import { StructuredData } from "../../../components/StructuredData";
import { AdSlot } from "../../../components/AdSlot";
import { adConfig } from "../../../lib/ads";
import { MetricBar } from "../../../components/primitives";

type Params = { locale: string; organ: string };

const localizedOrganTitles: Record<string, string> = {
  es: "{organ}: anatomía y modelo 3D",
  hi: "{organ}: शरीर रचना और 3D मॉडल",
  zh: "{organ}：解剖结构与 3D 模型",
  ar: "{organ}: التشريح ونموذج ثلاثي الأبعاد",
  pt: "{organ}: anatomia e modelo 3D",
  fr: "{organ} : anatomie et modèle 3D",
  de: "{organ}: Anatomie und 3D-Modell",
  ja: "{organ}：解剖構造と3Dモデル",
  ru: "{organ}: анатомия и 3D-модель",
  ko: "{organ}: 해부 구조와 3D 모델",
};

const localizedOrganSummaries: Record<string, string> = {
  es: " Gira el modelo 3D para reconocer las estructuras etiquetadas y relacionar su forma con la función del órgano.",
  hi: " 3D मॉडल को घुमाकर नामांकित संरचनाओं और इस अंग के कार्य के बीच संबंध समझें।",
  zh: " 旋转 3D 模型，查看标注结构，并了解这些结构与器官功能的关系。",
  ar: " أدر النموذج ثلاثي الأبعاد لتتعرف إلى الأجزاء المسمّاة وعلاقتها بوظيفة العضو.",
  pt: " Gire o modelo 3D para reconhecer as estruturas identificadas e relacionar sua forma à função do órgão.",
  fr: " Faites pivoter le modèle 3D pour identifier les structures légendées et relier leur forme à la fonction de l'organe.",
  de: " Drehe das 3D-Modell, erkenne die beschrifteten Strukturen und verbinde ihre Form mit der Funktion des Organs.",
  ja: " 3D モデルを回転させてラベル付きの構造を確認し、形と臓器の働きの関係を学べます。",
  ru: " Вращайте 3D-модель, изучайте подписанные структуры и связывайте их форму с функцией органа.",
  ko: " 3D 모형을 돌려 표시된 구조를 확인하고 형태와 장기 기능의 관계를 학습하세요.",
};

export function generateStaticParams({ params }: { params: { locale?: string } } = { params: {} }) {
  return (params.locale ? [params.locale] : localeCodes).flatMap((locale) => organIds.map((organ) => ({ locale, organ })));
}

/** Loads the locale, the specimen, and the joined dictionary in one place. */
async function resolve({ locale, organ }: Params) {
  if (!isLocale(locale) || !isOrganId(organ)) return null;
  const dictionary = await getDictionary(locale);
  const organs = buildOrgans(dictionary.organs, dictionary.ui);
  return {
    config: getLocale(locale),
    t: dictionary.ui,
    organs,
    organ: indexOrgans(organs)[organ as OrganId],
    systems: buildSystems(dictionary.ui),
  };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const resolved = await resolve(await params);
  if (!resolved) return {};
  const { config, t, organ } = resolved;

  return pageMetadata({
    locale: config,
    path: `/organ/${organ.id}`,
    type: "article",
    title: format(localizedOrganTitles[config.code] ?? t.seo.organTitle, { organ: organ.name }),
    // The dictionary description is a full sentence already, so the template
    // extends it rather than replacing it — no keyword-stuffed boilerplate.
    description: (localizedOrganTitles[config.code] ? `${organ.description}${localizedOrganSummaries[config.code] ?? ""}` : format(t.seo.organDescription, {
      description: organ.description,
      count: organ.hotspots.length,
      organ: organ.name,
      latin: organ.scientificName,
    })).slice(0, 300),
    image: organ.illustrated
      ? { url: `/anatomy/${organ.id}/organ.webp`, alt: `${organ.name} — ${organ.scientificName}`, width: 1024, height: 1024 }
      : undefined,
  });
}

export default async function OrganPage({ params }: { params: Promise<Params> }) {
  const resolved = await resolve(await params);
  if (!resolved) notFound();
  const { config, t, organ, organs, systems } = resolved;
  const locale = config.code;
  const ads = adConfig();

  const system = systems.find((entry) => entry.id === organ.systemId);
  const related = organ.related
    .map((id) => organs.find((item) => item.id === id))
    .filter((item): item is (typeof organs)[number] => Boolean(item));

  const trail = [
    { name: t.site.home, path: routes.studio(locale) },
    { name: t.pages.systemsTitle, path: routes.systems(locale) },
    ...(system ? [{ name: system.name, path: routes.system(locale, system.id) }] : []),
    { name: organ.name },
  ];

  const facts = [
    { label: t.info.size, value: organ.size },
    { label: t.info.weight, value: organ.weight },
    { label: t.info.location, value: organ.location },
    { label: t.info.bloodSupply, value: organ.bloodSupply },
    { label: t.info.function, value: organ.function },
    { label: t.info.daily, value: organ.dailyFact },
    { label: t.clinical.tissue, value: organ.tissue },
    { label: t.article.latinTerm, value: organ.scientificName },
  ];

  return (
    <>
      <StructuredData
        graphs={[
          breadcrumbGraph(
            trail.map((entry) => ({ name: entry.name, path: entry.path ?? `/${locale}/organ/${organ.id}` })),
          ),
          anatomyPageGraph({
            locale: config,
            path: `/${locale}/organ/${organ.id}`,
            name: organ.name,
            latin: organ.scientificName,
            description: organ.description,
            systemName: organ.system,
            bodyLocation: organ.location,
            functions: organ.function,
            conditions: organ.conditions,
            parts: organ.hotspots.map((hotspot) => ({
              name: hotspot.label,
              latin: hotspot.ta,
              description: hotspot.detail,
            })),
            image: organ.illustrated ? `/anatomy/${organ.id}/organ.webp` : "/og.jpg",
            reviewed: REVIEWED_DATE,
          }),
        ]}
      />

      <SiteHeader locale={config} t={t} />

      <main className="content-page">
        <Breadcrumbs t={t} trail={trail} />

        <article className="article" style={{ "--article-accent": organ.accent } as React.CSSProperties}>
          <header className="article-head">
            <p className="article-kicker">
              <span className="difficulty-chip" data-level={organ.difficulty}>{t.difficulty[organ.difficulty]}</span>
              {system && <Link href={routes.system(locale, system.id)}>{format(t.article.inSystem, { system: system.name })}</Link>}
            </p>
            <h1>{organ.name}</h1>
            <p className="article-latin" lang="la">{organ.scientificName}</p>
            <p className="article-lead">{organ.description}</p>
            <StudioCta t={t} href={studioLink(locale, organ.id)} />
          </header>

          {organ.illustrated && (
            <figure className="article-figure">
              <img
                src={`/anatomy/${organ.id}/organ.webp`}
                alt={`${organ.name} (${organ.scientificName})`}
                width={640}
                height={640}
                loading="eager"
                decoding="async"
              />
              <figcaption>{organ.name} — {organ.scientificName}</figcaption>
            </figure>
          )}

          {/* The summary block: the short, quotable answer a search result wants,
              stated once and not repeated in the sections below. */}
          <section className="article-summary" aria-labelledby="quick-answer">
            <h2 id="quick-answer">{t.article.quickAnswer}</h2>
            <p>{organ.medical}</p>
            <p>{organ.funFact}</p>
          </section>

          <section aria-labelledby="key-facts">
            <h2 id="key-facts">{t.article.keyFacts}</h2>
            <dl className="fact-table">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd><bdi dir="auto">{fact.value}</bdi></dd>
                </div>
              ))}
            </dl>
          </section>

          <AdSlot client={ads.client} slot={ads.article} format="inline" label={t.ads.label} />

          <section aria-labelledby="structures">
            <h2 id="structures">{t.article.structures}</h2>
            <p className="section-lead">{format(t.article.structureCount, { count: organ.hotspots.length })}</p>
            <ul className="structure-article-list">
              {organ.hotspots.map((hotspot) => (
                <li key={hotspot.id} style={{ "--dot": hotspot.color } as React.CSSProperties}>
                  <h3>{hotspot.label}</h3>
                  <p lang="la" className="structure-latin">{hotspot.ta}</p>
                  <p>{hotspot.detail}</p>
                  <Link href={studioLink(locale, organ.id, hotspot.id)}>
                    {format(t.article.viewStructure, { label: hotspot.label })} <ArrowRight size={13} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {organ.metrics.length > 0 && (
            <section aria-labelledby="physiology">
              <h2 id="physiology">{t.article.physiology}</h2>
              <p className="section-lead">{t.physiology.subtitle}</p>
              <div className="metric-stack">
                {organ.metrics.map((metric) => (
                  <MetricBar
                    key={metric.id}
                    label={metric.label}
                    value={metric.value}
                    max={metric.max}
                    unit={metric.unit}
                    band={metric.band}
                    accent={organ.accent}
                    rangeLabel={
                      metric.band
                        ? format(t.physiology.healthyRange, { low: metric.band[0], high: metric.band[1], unit: metric.unit })
                        : undefined
                    }
                  />
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="clinical">
            <h2 id="clinical">{t.article.clinical}</h2>
            <p>{organ.medical}</p>
            <ul className="condition-article-list">
              {organ.conditions.map((condition) => (
                <li key={condition}>{condition}</li>
              ))}
            </ul>
            <p className="disclaimer-block">{t.clinical.disclaimer}</p>
          </section>

          {related.length > 0 && (
            <section aria-labelledby="related">
              <h2 id="related">{t.article.related}</h2>
              <div className="related-grid">
                {related.map((item) => (
                  <Link key={item.id} href={routes.organ(locale, item.id)} className="related-tile">
                    {item.illustrated && (
                      <img src={`/anatomy/${item.id}/thumb.webp`} alt="" width={48} height={48} loading="lazy" decoding="async" />
                    )}
                    <span>
                      <b>{item.name}</b>
                      <small>{item.system}</small>
                    </span>
                    <ArrowRight size={14} />
                  </Link>
                ))}
              </div>
            </section>
          )}

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
