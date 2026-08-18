import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AnatomyApp } from "../components/AnatomyApp";
import { SiteFooter } from "../components/SiteChrome";
import { StructuredData } from "../components/StructuredData";
import { getDictionary } from "../i18n/dictionaries";
import { getLocale, isLocale, localeCodes } from "../i18n/config";
import { buildOrgans, buildSystems } from "../i18n/merge";
import { format } from "../i18n/types";
import { routes } from "../lib/routes";
import { absolute, pageMetadata, websiteGraph } from "../lib/seo";

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
    path: "",
    title: ui.meta.title,
    description: ui.meta.description,
    image: { url: "/og.jpg", alt: ui.meta.imageAlt },
  });
}

export default async function Home({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const config = getLocale(locale);
  const dictionary = await getDictionary(locale);
  const t = dictionary.ui;
  const organs = buildOrgans(dictionary.organs, t);
  const systems = buildSystems(t);

  return (
    <>
      <StructuredData
        graphs={[
          websiteGraph(config, t.meta.description),
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Anatomy Atelier",
            url: absolute(routes.studio(locale)),
            applicationCategory: "EducationalApplication",
            operatingSystem: "Any browser with WebGL",
            inLanguage: config.code,
            isAccessibleForFree: true,
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            featureList: [
              t.tools.section,
              t.tools.xray,
              t.tools.measure,
              t.lessons.title,
              t.quiz.chooseMode,
              t.compare.title,
            ],
          },
        ]}
      />

      <AnatomyApp locale={config} dictionary={dictionary} />

      {/*
        The studio is a client app whose whole interface lives behind buttons and
        modals, so on its own the home page exposes no links at all. This section
        is server-rendered: it is how a reader without JavaScript reaches the
        reference pages, and how a crawler discovers them from the root.
      */}
      <section className="studio-index" aria-labelledby="studio-index-heading">
        <div className="studio-index-inner">
          <h2 id="studio-index-heading">{t.pages.organsTitle}</h2>
          <ul className="studio-index-organs">
            {organs.map((organ) => (
              <li key={organ.id}>
                <Link href={routes.organ(locale, organ.id)}>
                  {organ.illustrated && (
                    <img src={`/anatomy/${organ.id}/thumb.webp`} alt="" width={40} height={40} loading="lazy" decoding="async" />
                  )}
                  <span>
                    <b>{organ.name}</b>
                    <small>{format(t.article.structureCount, { count: organ.hotspots.length })}</small>
                  </span>
                  <ArrowRight size={13} />
                </Link>
              </li>
            ))}
          </ul>

          <h2>{t.pages.systemsTitle}</h2>
          <ul className="studio-index-links">
            {systems.map((system) => (
              <li key={system.id}>
                <Link href={routes.system(locale, system.id)}>{system.name}</Link>
              </li>
            ))}
          </ul>

          <ul className="studio-index-links">
            <li><Link href={routes.systems(locale)}>{t.pages.systemsTitle}</Link></li>
            <li><Link href={routes.glossary(locale)}>{t.pages.glossaryTitle}</Link></li>
            <li><Link href={routes.lessons(locale)}>{t.pages.lessonsTitle}</Link></li>
            <li><Link href={routes.about(locale)}>{t.pages.aboutTitle}</Link></li>
            <li><Link href={routes.privacy(locale)}>{t.pages.privacyTitle}</Link></li>
          </ul>
        </div>
      </section>

      <SiteFooter
        locale={config}
        t={t}
        organLinks={organs.map((organ) => ({ name: organ.name, href: routes.organ(locale, organ.id) }))}
      />
    </>
  );
}
