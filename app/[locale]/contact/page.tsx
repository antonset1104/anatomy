import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, isLocale, localeCodes } from "../../i18n/config";
import { getDictionary } from "../../i18n/dictionaries";
import { SiteHeader, SiteFooter } from "../../components/SiteChrome";
import { CopyValue } from "../../components/CopyValue";
import { studentNav } from "../../lib/student-ui";
import { CONTACT_EMAIL, supportCopy } from "../../lib/support";
import { pageMetadata } from "../../lib/seo";
type Props = { params: Promise<{ locale: string }> };
export function generateStaticParams() { return localeCodes.map(locale => ({ locale })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return pageMetadata({ locale: getLocale(locale), path: "/contact", title: studentNav[locale].contact, description: supportCopy[locale].contact });
}
export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const config = getLocale(locale), t = supportCopy[locale];
  const { ui } = await getDictionary(locale);
  return <><SiteHeader locale={config} t={ui} /><main className="content-page study-page">
    <header className="page-head"><h1>{studentNav[locale].contact}</h1><p>{t.contact}</p></header>
    <section className="support-card"><h2>Anatomy Atelier · Vijeron</h2><a className="studio-cta" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a><CopyValue value={CONTACT_EMAIL} label={t.copy} copied={t.copied} failed={t.failed} /></section>
    <p className="study-disclosure">{t.privacy}</p>
  </main><SiteFooter locale={config} t={ui} organLinks={[]} languagePath="/contact" /></>;
}
