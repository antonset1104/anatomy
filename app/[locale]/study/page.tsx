import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, isLocale, localeCodes } from "../../i18n/config";
import { getDictionary } from "../../i18n/dictionaries";
import { SiteHeader, SiteFooter } from "../../components/SiteChrome";
import { StructuredData } from "../../components/StructuredData";
import { StudyTools } from "../../components/StudyTools";
import { getStudyModules, STUDY_UPDATED } from "../../lib/medical-study";
import { studentNav, studyUi } from "../../lib/student-ui";
import { absolute, pageMetadata } from "../../lib/seo";

type Props = { params: Promise<{ locale: string }> };
export function generateStaticParams() { return localeCodes.map(locale => ({ locale })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const available = locale === "en" || locale === "id";
  return { ...pageMetadata({ locale: getLocale(locale), path: "/study", title: studentNav[locale].study, description: available ? studyUi(locale).intro : studentNav[locale].availability }),
    ...(!available ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical: `/${locale}/study`, languages: { en: "/en/study", id: "/id/study", "x-default": "/en/study" } },
  };
}
export default async function StudyPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const config = getLocale(locale);
  const { ui } = await getDictionary(locale);
  const t = studyUi(locale);
  const available = locale === "en" || locale === "id";
  const modules = getStudyModules(locale);
  return <>
    <SiteHeader locale={config} t={ui} />
    <main className="content-page study-page">
      <header className="page-head"><h1>{studentNav[locale].study}</h1><p>{available ? t.intro : studentNav[locale].availability}</p></header>
      <nav className="study-controls" aria-label={ui.language.label}><Link href="/en/study" lang="en" hrefLang="en">English</Link><Link href="/id/study" lang="id" hrefLang="id">Bahasa Indonesia</Link></nav>
      {available && <>
        <p className="study-disclosure">{t.scope}</p>
        <p>{t.updated}: <time dateTime={STUDY_UPDATED}>{STUDY_UPDATED}</time> · 8 {t.modules.toLowerCase()} · 16 {t.quiz.toLowerCase()}</p>
        <div className="hub-grid">{modules.map((m, i) => <article className="hub-card" key={m.id}><p className="hub-meta">{String(i + 1).padStart(2, "0")}</p><h2><Link href={`/${locale}/study/${m.id}`}>{m.title}</Link></h2><p>{m.summary}</p><ul>{m.objectives.map(o => <li key={o}>{o}</li>)}</ul><Link className="text-link" href={`/${locale}/study/${m.id}`}>{t.start} →</Link></article>)}</div>
        <StudyTools modules={modules} locale={locale} />
        <StructuredData graphs={[{ "@context": "https://schema.org", "@type": "CollectionPage", name: studentNav[locale].study, url: absolute(`/${locale}/study`), inLanguage: locale, dateModified: STUDY_UPDATED, description: t.intro, hasPart: modules.map(m => ({ "@type": "LearningResource", name: m.title, url: absolute(`/${locale}/study/${m.id}`), educationalLevel: "Undergraduate", learningResourceType: "Study module", isAccessibleForFree: true })) }]} />
      </>}
    </main>
    <SiteFooter locale={config} t={ui} organLinks={[]} languagePath="/study" availableLocaleCodes={["en", "id"]} />
  </>;
}
