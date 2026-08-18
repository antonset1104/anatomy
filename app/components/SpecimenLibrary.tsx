"use client";

import { useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, Search, Sparkles, X } from "lucide-react";
import type { Organ, System } from "../i18n/merge";
import { format, type UiDictionary } from "../i18n/types";
import type { OrganId, SystemId } from "../lib/anatomy-data";
import type { Progress } from "../lib/store";
import { organMastery } from "../lib/store";
import { OrganArt } from "./primitives";

export function SpecimenLibrary({
  t,
  locale,
  organs,
  systems,
  progress,
  activeId,
  open,
  onSelect,
  onPrefetch,
  onClose,
}: {
  t: UiDictionary;
  locale: string;
  organs: Organ[];
  systems: System[];
  progress: Progress;
  activeId: OrganId;
  open: boolean;
  onSelect: (id: OrganId) => void;
  onPrefetch: (id: OrganId) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [system, setSystem] = useState<SystemId | "all">("all");
  const [savedOnly, setSavedOnly] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    return organs.filter((organ) => {
      if (system !== "all" && organ.systemId !== system) return false;
      if (savedOnly && !progress.bookmarks.includes(organ.id)) return false;
      if (!needle) return true;
      return `${organ.name} ${organ.system} ${organ.scientificName} ${organ.hotspots.map((h) => h.label).join(" ")}`
        .toLocaleLowerCase(locale)
        .includes(needle);
    });
  }, [organs, query, system, savedOnly, progress.bookmarks, locale]);

  return (
    <aside className={`organ-library ${open ? "open" : ""}`} aria-label={t.library.title}>
      <div className="panel-heading">
        <span>{t.library.title}</span>
        <button type="button" aria-label={t.library.close} className="mobile-close icon-button" onClick={onClose}>
          <X size={16} />
        </button>
        <button
          type="button"
          className={`icon-button ${savedOnly ? "active" : ""}`}
          aria-pressed={savedOnly}
          aria-label={t.library.saved}
          onClick={() => setSavedOnly((value) => !value)}
        >
          {savedOnly ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
        </button>
      </div>

      <label className="library-search">
        <Search size={14} aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.search.placeholder}
          aria-label={t.search.placeholder}
        />
        {query && (
          <button type="button" aria-label={t.search.clear} onClick={() => setQuery("")}>
            <X size={13} />
          </button>
        )}
      </label>

      <div className="system-chips" role="group" aria-label={t.library.filterLabel}>
        <button type="button" className={system === "all" ? "active" : ""} onClick={() => setSystem("all")}>
          {t.library.filterAll}
        </button>
        {systems.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={system === entry.id ? "active" : ""}
            style={{ "--chip-accent": entry.accent } as React.CSSProperties}
            onClick={() => setSystem(entry.id)}
          >
            {entry.name}
          </button>
        ))}
      </div>

      <div className="organ-list">
        {filtered.length === 0 && <p className="muted-note">{t.library.emptyFilter}</p>}
        {filtered.map((item) => {
          const mastery = organMastery(progress, item.id, item.hotspots.length);
          return (
            <button
              type="button"
              key={item.id}
              className={`organ-item ${activeId === item.id ? "active" : ""}`}
              onClick={() => onSelect(item.id)}
              onPointerEnter={() => onPrefetch(item.id)}
              onFocus={() => onPrefetch(item.id)}
              style={{ "--item-accent": item.accent } as React.CSSProperties}
            >
              <span className="organ-glyph">
                <OrganArt organ={item} asset="thumb" alt="" size={44} />
              </span>
              <span className="organ-item-text">
                <b>{item.name}</b>
                <small>{item.system}</small>
                <i className="organ-progress" aria-hidden>
                  <i style={{ inlineSize: `${mastery}%` }} />
                </i>
              </span>
              {progress.bookmarks.includes(item.id) && <BookmarkCheck className="favorite" size={13} />}
            </button>
          );
        })}
      </div>

      <p className="library-count">{format(t.library.count, { count: filtered.length })}</p>

      <blockquote>
        <Sparkles size={17} />
        <p>{t.library.quoteLine1}<br />{t.library.quoteLine2}</p>
        <em>{t.library.quoteSign}</em>
      </blockquote>
    </aside>
  );
}
