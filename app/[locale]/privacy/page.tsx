import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, isLocale, localeCodes } from "../../i18n/config";
import { getDictionary } from "../../i18n/dictionaries";
import { buildOrgans } from "../../i18n/merge";
import { format } from "../../i18n/types";
import { routes } from "../../lib/routes";
import { absolute, breadcrumbGraph, pageMetadata } from "../../lib/seo";
import { POLICY_DATE } from "../../lib/content-meta";
import { Breadcrumbs, SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { StructuredData } from "../../components/StructuredData";

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
    path: "/privacy",
    title: ui.pages.privacyTitle,
    description: ui.pages.privacyDescription,
  });
}

export default async function PrivacyPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const config = getLocale(locale);
  const { ui: t, organs: content } = await getDictionary(locale);
  const organs = buildOrgans(content, t);

  const trail = [
    { name: t.site.home, path: routes.studio(locale) },
    { name: t.pages.privacyTitle },
  ];

  const sections = [
    { heading: t.privacy.storageHeading, body: t.privacy.storageBody },
    { heading: t.privacy.analyticsHeading, body: t.privacy.analyticsBody },
    { heading: t.privacy.adsHeading, body: t.privacy.adsBody },
    { heading: t.privacy.childrenHeading, body: t.privacy.childrenBody },
    { heading: t.privacy.rightsHeading, body: t.privacy.rightsBody },
    { heading: t.privacy.changesHeading, body: t.privacy.changesBody },
  ];

  return (
    <>
      <StructuredData
        graphs={[
          breadcrumbGraph([
            { name: t.site.home, path: routes.studio(locale) },
            { name: t.pages.privacyTitle, path: routes.privacy(locale) },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            url: absolute(routes.privacy(locale)),
            name: t.pages.privacyTitle,
            description: t.pages.privacyDescription,
            inLanguage: config.code,
            dateModified: POLICY_DATE,
            isPartOf: { "@id": absolute("/#website") },
          },
        ]}
      />

      <SiteHeader locale={config} t={t} />

      <main className="content-page">
        <Breadcrumbs t={t} trail={trail} />

        <article className="article prose">
          <header className="article-head">
            <h1>{t.pages.privacyTitle}</h1>
            <p className="article-lead">{t.privacy.lead}</p>
            <p className="reviewed-note">{format(t.site.updated, { date: POLICY_DATE })}</p>
          </header>

          {sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
            </section>
          ))}
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
