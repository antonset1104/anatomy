"use client";

import {
  BookMarked,
  BrainCircuit,
  ChevronDown,
  Compass,
  GraduationCap,
  Globe,
  LibraryBig,
  Monitor,
  Moon,
  Search,
  Settings2,
  Sun,
  Trophy,
} from "lucide-react";
import type { LocaleConfig } from "../i18n/config";
import { locales } from "../i18n/config";
import type { UiDictionary } from "../i18n/types";
import type { Prefs } from "../lib/store";

/**
 * Switches language by swapping the leading path segment, so the current
 * document is preserved rather than bouncing through the root redirect.
 *
 * The native <select> is stretched transparently over the whole pill rather
 * than sitting inline. A <label> only *focuses* a select when clicked — it does
 * not open it — so anything outside the select's own box (the globe, the
 * chevron, the padding) would otherwise be a dead zone. Overlaying it means a
 * click anywhere on the control opens the picker, while the visible row
 * underneath stays fully styleable.
 */
function LanguageSwitcher({ locale, t }: { locale: LocaleConfig; t: UiDictionary }) {
  return (
    <div className="language-switcher" title={t.language.label}>
      <Globe size={15} aria-hidden />
      <span className="language-current">{locale.nativeName}</span>
      <ChevronDown size={13} aria-hidden />
      <select
        aria-label={t.language.choose}
        value={locale.code}
        onChange={(event) => {
          const url = new URL(window.location.href);
          url.pathname = `/${event.target.value}`;
          window.location.assign(url);
        }}
      >
        {locales.map((entry) => (
          <option key={entry.code} value={entry.code} lang={entry.code}>
            {entry.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
}

const THEME_ICON = { light: Sun, dark: Moon, system: Monitor };

function ThemeToggle({ t, theme, onChange }: { t: UiDictionary; theme: Prefs["theme"]; onChange: (value: Prefs["theme"]) => void }) {
  const order: Prefs["theme"][] = ["system", "light", "dark"];
  const Icon = THEME_ICON[theme];
  const label = theme === "system" ? t.theme.system : theme === "light" ? t.theme.light : t.theme.dark;
  return (
    <button
      type="button"
      className="icon-button"
      title={`${t.theme.label}: ${label}`}
      aria-label={`${t.theme.label}: ${label}`}
      onClick={() => onChange(order[(order.indexOf(theme) + 1) % order.length])}
    >
      <Icon size={16} />
    </button>
  );
}

export type TopBarView = "explore" | "systems" | "lessons" | "glossary" | "progress";

export function TopBar({
  t,
  locale,
  prefs,
  streak,
  mastery,
  onCommand,
  onNav,
  onTheme,
  onSettings,
  onOpenLibrary,
  onHome,
}: {
  t: UiDictionary;
  locale: LocaleConfig;
  prefs: Prefs;
  streak: number;
  mastery: number;
  onCommand: () => void;
  onNav: (view: TopBarView) => void;
  onTheme: (theme: Prefs["theme"]) => void;
  onSettings: () => void;
  onOpenLibrary: () => void;
  onHome: () => void;
}) {
  const nav: { id: TopBarView; label: string; icon: typeof Compass }[] = [
    { id: "explore", label: t.nav.explore, icon: Compass },
    { id: "systems", label: t.nav.systems, icon: BrainCircuit },
    { id: "lessons", label: t.nav.lessons, icon: GraduationCap },
    { id: "glossary", label: t.nav.glossary, icon: BookMarked },
  ];

  return (
    <header className="topbar">
      <button className="brand" type="button" onClick={onHome} aria-label={t.brand.home}>
        <strong>Anatomy Atelier<sup>✦</sup></strong>
        <em>{t.brand.tagline}</em>
      </button>

      <nav className="main-nav" aria-label="Primary navigation">
        {nav.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={id === "explore" ? "active" : ""} onClick={() => onNav(id)}>
            <Icon size={16} /> <span>{label}</span>
          </button>
        ))}
      </nav>

      <button className="command-trigger" type="button" onClick={onCommand} aria-label={t.command.open}>
        <Search size={15} />
        <span>{t.command.hint}</span>
        <kbd>⌘K</kbd>
      </button>

      <div className="topbar-side">
        <button type="button" className="streak-chip" onClick={() => onNav("progress")} title={t.progress.title}>
          <Trophy size={14} />
          <b>{mastery}%</b>
          {streak > 0 && <small>· {streak}🔥</small>}
        </button>
        <LanguageSwitcher locale={locale} t={t} />
        <ThemeToggle t={t} theme={prefs.theme} onChange={onTheme} />
        <button type="button" className="icon-button" onClick={onSettings} aria-label={t.settings.title}>
          <Settings2 size={16} />
        </button>
        <button type="button" className="icon-button mobile-library-trigger" onClick={onOpenLibrary} aria-label={t.library.open}>
          <LibraryBig size={18} />
        </button>
      </div>
    </header>
  );
}
