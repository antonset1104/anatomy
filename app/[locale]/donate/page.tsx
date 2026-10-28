import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, isLocale, localeCodes } from "../../i18n/config";
import { getDictionary } from "../../i18n/dictionaries";
import { SiteHeader, SiteFooter } from "../../components/SiteChrome";
import { CopyValue } from "../../components/CopyValue";
import { studentNav } from "../../lib/student-ui";
import { donationWallets, PAYPAL_EMAIL, supportCopy } from "../../lib/support";
import { pageMetadata } from "../../lib/seo";
type Props = { params: Promise<{ locale: string }> };
export function generateStaticParams() { return localeCodes.map(locale => ({ locale })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { ...pageMetadata({ locale: getLocale(locale), path: "/donate", title: studentNav[locale].donate, description: supportCopy[locale].lead }), robots: { index: false, follow: true } };
}
export default async function DonatePage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const config = getLocale(locale), t = supportCopy[locale];
  const { ui } = await getDictionary(locale);
  return <><SiteHeader locale={config} t={ui} /><main className="content-page study-page">
    <header className="page-head"><h1>{studentNav[locale].donate}</h1><p>{t.lead}</p></header>
    <section className="support-card"><h2>PayPal</h2><p>{t.paypal}</p><CopyValue value={PAYPAL_EMAIL} label={t.copy} copied={t.copied} failed={t.failed} donationMethod="paypal" /><a className="studio-cta" href="https://www.paypal.com/" target="_blank" rel="noopener noreferrer">PayPal ↗</a></section>
    <p className="study-disclosure">{t.crypto}</p>
    <div className="hub-grid">{donationWallets.map(w => <section className="support-card" key={w.asset}><h2>{w.asset}</h2><p lang="en" dir="ltr">{w.network}</p><CopyValue value={w.address} label={t.copy} copied={t.copied} failed={t.failed} donationMethod={w.asset.toLowerCase()} /></section>)}</div>
    <p>{t.terms}</p><p>{t.privacy}</p><Link className="text-link" href={`/${locale}/contact`}>{studentNav[locale].contact} →</Link>
  </main><SiteFooter locale={config} t={ui} organLinks={[]} languagePath="/donate" /></>;
}
