import Link from "next/link";
import { ChevronRight, Cuboid } from "lucide-react";
import type { LocaleConfig } from "../i18n/config";
import { locales } from "../i18n/config";
import { format, type UiDictionary } from "../i18n/types";
import { routes } from "../lib/routes";

/**
 * Header and footer for the content pages. Server components with no client
 * bundle at all — an article page must not pay for the studio's JavaScript, and
 * every link here has to be a real `<a href>` a crawler can follow.
 */
export function SiteHeader({ locale, t }: { locale: LocaleConfig; t: UiDictionary }) {
  const nav = [
    { href: routes.systems(locale.code), label: t.pages.systemsTitle },
    { href: routes.glossary(locale.code), label: t.pages.glossaryTitle },
    { href: routes.lessons(locale.code), label: t.pages.lessonsTitle },
    { href: routes.about(locale.code), label: t.pages.aboutTitle },
  ];

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href={routes.studio(locale.code)} className="site-brand">
          <strong>Anatomy Atelier<sup>✦</sup></strong>
        </Link>
        <nav aria-label={t.site.nav}>
          {nav.map((entry) => (
            <Link key={entry.href} href={entry.href}>{entry.label}</Link>
          ))}
        </nav>
        <Link href={routes.studio(locale.code)} className="site-cta">
          <Cuboid size={15} /> {t.site.openStudio}
        </Link>
      </div>
    </header>
  );
}

export function Breadcrumbs({ t, trail }: { t: UiDictionary; trail: { name: string; path?: string }[] }) {
  return (
    <nav className="breadcrumbs" aria-label={t.site.breadcrumb}>
      <ol>
        {trail.map((entry, index) => (
          <li key={`${entry.name}-${index}`}>
            {entry.path ? <Link href={entry.path}>{entry.name}</Link> : <span aria-current="page">{entry.name}</span>}
            {index < trail.length - 1 && <ChevronRight size={12} aria-hidden />}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function SiteFooter({
  locale,
  t,
  organLinks,
}: {
  locale: LocaleConfig;
  t: UiDictionary;
  /** Passed in so the footer doubles as a crawlable index of every specimen. */
  organLinks: { name: string; href: string }[];
}) {
  const year = new Date().getUTCFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-col">
          <h2>{t.pages.organsTitle}</h2>
          <ul>
            {organLinks.map((organ) => (
              <li key={organ.href}><Link href={organ.href}>{organ.name}</Link></li>
            ))}
          </ul>
        </div>

        <div className="site-footer-col">
          <h2>{t.site.nav}</h2>
          <ul>
            <li><Link href={routes.studio(locale.code)}>{t.site.openStudio}</Link></li>
            <li><Link href={routes.systems(locale.code)}>{t.pages.systemsTitle}</Link></li>
            <li><Link href={routes.glossary(locale.code)}>{t.pages.glossaryTitle}</Link></li>
            <li><Link href={routes.lessons(locale.code)}>{t.pages.lessonsTitle}</Link></li>
            <li><Link href={routes.about(locale.code)}>{t.pages.aboutTitle}</Link></li>
            <li><Link href={routes.privacy(locale.code)}>{t.pages.privacyTitle}</Link></li>
          </ul>
        </div>

        {/* Real anchors rather than a <select>: the language switcher on a content
            page is also how a crawler discovers the other eleven translations. */}
        <div className="site-footer-col">
          <h2>{t.language.label}</h2>
          <ul className="site-footer-locales">
            {locales.map((entry) => (
              <li key={entry.code}>
                <Link href={`/${entry.code}`} hrefLang={entry.code} lang={entry.code}>
                  {entry.nativeName}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="site-footer-note">{t.site.footerNote}</p>
      <p className="site-footer-note">© {year} · {t.site.footerRights}</p>
    </footer>
  );
}

/** The one banner an article shows: the studio is the point of the site. */
export function StudioCta({
  t,
  href,
  label,
}: {
  t: UiDictionary;
  href: string;
  label?: string;
}) {
  return (
    <Link href={href} className="studio-cta">
      <Cuboid size={17} />
      <span>{label ?? t.site.exploreIn3d}</span>
      <ChevronRight size={15} />
    </Link>
  );
}

export function ReviewedNote({ t, date }: { t: UiDictionary; date: string }) {
  return <p className="reviewed-note">{format(t.article.reviewed, { date })} · {t.article.sources}</p>;
}
