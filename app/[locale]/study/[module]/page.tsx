import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "../../../i18n/config";
import { getDictionary } from "../../../i18n/dictionaries";
import { SiteHeader, SiteFooter } from "../../../components/SiteChrome";
import { StructuredData } from "../../../components/StructuredData";
import { StudyTools } from "../../../components/StudyTools";
import { getStudyModules, studyLanguages, studyModuleIds, STUDY_UPDATED } from "../../../lib/medical-study";
import { studentNav, studyUi } from "../../../lib/student-ui";
import { absolute, pageMetadata } from "../../../lib/seo";
import { studioLink } from "../../../lib/routes";

type Props = { params: Promise<{ locale: string; module: string }> };
export function generateStaticParams({ params }: { params: { locale?: string } } = { params: {} }) {
  return studyLanguages.filter(locale => !params.locale || params.locale === locale).flatMap(locale => studyModuleIds.map(module => ({ locale, module })));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, module } = await params;
  const item = getStudyModules(locale).find(m => m.id === module);
  if (!item || !studyLanguages.some(l => l === locale)) return {};
  const meta = pageMetadata({ locale: getLocale(locale), path: `/study/${module}`, title: item.title, description: item.summary, type: "article" });
  meta.alternates = { canonical: `/${locale}/study/${module}`, languages: { en: `/en/study/${module}`, id: `/id/study/${module}`, "x-default": `/en/study/${module}` } };
  if (meta.openGraph) meta.openGraph.alternateLocale = [locale === "id" ? "en_US" : "id_ID"];
  return meta;
}
export default async function ModulePage({ params }: Props) {
  const { locale, module } = await params;
  if (!studyLanguages.some(l => l === locale)) notFound();
  const modules = getStudyModules(locale);
  const item = modules.find(m => m.id === module);
  if (!item) notFound();
  const { ui } = await getDictionary(locale);
  const config = getLocale(locale), t = studyUi(locale);
  return <>
    <SiteHeader locale={config} t={ui} />
    <main className="content-page study-page">
      <nav className="study-controls"><Link href={`/${locale}/study`}>← {studentNav[locale].study}</Link><Link href={`/en/study/${module}`} lang="en" hrefLang="en">English</Link><Link href={`/id/study/${module}`} lang="id" hrefLang="id">Bahasa Indonesia</Link></nav>
      <article className="article">
        <header className="article-head"><h1>{item.title}</h1><p className="article-lead">{item.summary}</p><p>{t.updated}: <time dateTime={STUDY_UPDATED}>{STUDY_UPDATED}</time></p></header>
        <p className="study-disclosure">{t.scope}</p>
        <section><h2>{t.objectives}</h2><ul>{item.objectives.map(o => <li key={o}>{o}</li>)}</ul></section>
        {item.sections.map(s => <section key={s.title}><h2>{s.title}</h2><p>{s.body}</p></section>)}
        <section><h2>{t.station}</h2><p>{item.task}</p><details className="study-answer"><summary>{t.reveal}</summary><p>{item.reasoning}</p></details></section>
        {module === "synovial-joints" ? <p className="study-note">{t.noModel}</p> : <Link className="studio-cta" href={studioLink(locale, item.organ)}>{t.explore} →</Link>}
        <section><h2>{t.sources}</h2><ul>{item.sources.map(s => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></li>)}</ul></section>
      </article>
      <StudyTools modules={[item]} locale={locale} />
      <nav className="study-controls" aria-label={t.modules}>{modules.filter(m => m.id !== module).map(m => <Link key={m.id} href={`/${locale}/study/${m.id}`}>{m.title}</Link>)}</nav>
    </main>
    <StructuredData graphs={[{ "@context": "https://schema.org", "@type": "LearningResource", name: item.title, description: item.summary, url: absolute(`/${locale}/study/${module}`), inLanguage: locale, dateModified: STUDY_UPDATED, educationalLevel: "Undergraduate", learningResourceType: "Study module", teaches: item.objectives, isAccessibleForFree: true, publisher: { "@type": "Organization", name: "Anatomy Atelier" }, citation: item.sources.map(s => s.url) }]} />
    <SiteFooter locale={config} t={ui} organLinks={[]} languagePath={`/study/${module}`} availableLocaleCodes={studyLanguages} />
  </>;
}
