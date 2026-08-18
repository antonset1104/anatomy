import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, isLocale, localeCodes } from "../../i18n/config";
import { getDictionary } from "../../i18n/dictionaries";
import { buildOrgans } from "../../i18n/merge";
import { format } from "../../i18n/types";
import { routes } from "../../lib/routes";
import { absolute, breadcrumbGraph, pageMetadata, siteName } from "../../lib/seo";
import { REVIEWED_DATE } from "../../lib/content-meta";
import { Breadcrumbs, SiteFooter, SiteHeader, StudioCta } from "../../components/SiteChrome";
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
    path: "/about",
    title: ui.pages.aboutTitle,
    description: ui.pages.aboutDescription,
  });
}

export default async function AboutPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const config = getLocale(locale);
  const { ui: t, organs: content } = await getDictionary(locale);
  const organs = buildOrgans(content, t);

  const trail = [
    { name: t.site.home, path: routes.studio(locale) },
    { name: t.pages.aboutTitle },
  ];

  const sections = [
    { heading: t.about.whatHeading, body: t.about.whatBody },
    { heading: t.about.howHeading, body: t.about.howBody },
    { heading: t.about.namingHeading, body: t.about.namingBody },
    { heading: t.about.limitsHeading, body: t.about.limitsBody },
    { heading: t.about.contactHeading, body: t.about.contactBody },
  ];

  return (
    <>
      <StructuredData
        graphs={[
          breadcrumbGraph([
            { name: t.site.home, path: routes.studio(locale) },
            { name: t.pages.aboutTitle, path: routes.about(locale) },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "AboutPage",
            url: absolute(routes.about(locale)),
            name: t.pages.aboutTitle,
            description: t.pages.aboutDescription,
            inLanguage: config.code,
            isPartOf: { "@id": absolute("/#website") },
            about: { "@id": absolute("/#publisher") },
            publisher: {
              "@type": "Organization",
              "@id": absolute("/#publisher"),
              name: siteName,
              url: absolute("/"),
            },
          },
        ]}
      />

      <SiteHeader locale={config} t={t} />

      <main className="content-page">
        <Breadcrumbs t={t} trail={trail} />

        <article className="article prose">
          <header className="article-head">
            <h1>{t.pages.aboutTitle}</h1>
            <p className="article-lead">{t.about.lead}</p>
            <StudioCta t={t} href={routes.studio(locale)} label={t.site.openStudio} />
          </header>

          {sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
            </section>
          ))}

          <section>
            <h2>{t.pages.organsTitle}</h2>
            <ul className="plain-list columns">
              {organs.map((organ) => (
                <li key={organ.id}>
                  <Link href={routes.organ(locale, organ.id)}>{organ.name}</Link>
                  <span lang="la"> · {organ.scientificName}</span>
                </li>
              ))}
            </ul>
          </section>

          <p className="reviewed-note">{format(t.site.updated, { date: REVIEWED_DATE })}</p>
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
