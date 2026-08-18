"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Boxes, CornerDownLeft, Layers3, Play, Search, Sparkles } from "lucide-react";
import type { Organ, System } from "../i18n/merge";
import type { OrganId } from "../lib/anatomy-data";
import { format, type UiDictionary } from "../i18n/types";

export type CommandAction = { id: string; label: string; run: () => void };

type Row =
  | { kind: "organ"; id: string; label: string; hint: string; organ: Organ }
  | { kind: "structure"; id: string; label: string; hint: string; organId: OrganId; hotspotId: string; color: string }
  | { kind: "system"; id: string; label: string; hint: string; system: System }
  | { kind: "lesson"; id: string; label: string; hint: string; organId: OrganId }
  | { kind: "action"; id: string; label: string; hint: string; run: () => void };

const GROUP_ICON = { organ: Boxes, structure: Layers3, system: Sparkles, lesson: Play, action: ArrowRight };
const LIMIT_PER_GROUP = 5;

/**
 * Substring matching on a normalised haystack. A real fuzzy ranker would be
 * overkill for a few hundred rows, and substring order is easier to predict
 * while typing an anatomical term you are only half sure of.
 */
function normalise(value: string, locale: string) {
  return value.toLocaleLowerCase(locale).normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function CommandPalette({
  t,
  locale,
  organs,
  systems,
  actions,
  onOpenOrgan,
  onOpenStructure,
  onOpenSystem,
  onStartLesson,
  onClose,
}: {
  t: UiDictionary;
  locale: string;
  organs: Organ[];
  systems: System[];
  actions: CommandAction[];
  onOpenOrgan: (id: OrganId) => void;
  onOpenStructure: (organId: OrganId, hotspotId: string) => void;
  onOpenSystem: (system: System) => void;
  onStartLesson: (organId: OrganId) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  const rows = useMemo<Row[]>(() => {
    const needle = normalise(query.trim(), locale);
    const match = (haystack: string) => !needle || normalise(haystack, locale).includes(needle);

    const organRows: Row[] = organs
      .filter((organ) => match(`${organ.name} ${organ.system} ${organ.scientificName}`))
      .slice(0, LIMIT_PER_GROUP)
      .map((organ) => ({ kind: "organ", id: `organ:${organ.id}`, label: organ.name, hint: organ.system, organ }));

    const structureRows: Row[] = organs
      .flatMap((organ) => organ.hotspots.map((hotspot) => ({ organ, hotspot })))
      .filter(({ hotspot }) => needle.length > 0 && match(`${hotspot.label} ${hotspot.ta} ${hotspot.detail}`))
      .slice(0, LIMIT_PER_GROUP)
      .map(({ organ, hotspot }) => ({
        kind: "structure",
        id: `structure:${organ.id}:${hotspot.id}`,
        label: hotspot.label,
        hint: `${organ.name} · ${hotspot.ta}`,
        organId: organ.id,
        hotspotId: hotspot.id,
        color: hotspot.color,
      }));

    const systemRows: Row[] = systems
      .filter((system) => needle.length > 0 && match(`${system.name} ${system.role}`))
      .slice(0, LIMIT_PER_GROUP)
      .map((system) => ({ kind: "system", id: `system:${system.id}`, label: system.name, hint: system.role, system }));

    const lessonRows: Row[] = organs
      .filter((organ) => needle.length > 0 && match(`${t.lessons.title} ${organ.name}`))
      .slice(0, LIMIT_PER_GROUP)
      .map((organ) => ({
        kind: "lesson",
        id: `lesson:${organ.id}`,
        label: `${t.lessons.start} — ${organ.name}`,
        hint: format(t.lessons.duration, { count: organ.hotspots.length }),
        organId: organ.id,
      }));

    const actionRows: Row[] = actions
      .filter((action) => match(action.label))
      .slice(0, LIMIT_PER_GROUP)
      .map((action) => ({ kind: "action", id: `action:${action.id}`, label: action.label, hint: t.search.actions, run: action.run }));

    return [...organRows, ...structureRows, ...systemRows, ...lessonRows, ...actionRows];
  }, [query, locale, organs, systems, actions, t]);

  // A filtered-down list must not leave the cursor pointing past the end, so the
  // effective index is clamped at read time rather than corrected afterwards.
  const active = rows.length ? Math.min(cursor, rows.length - 1) : 0;

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, rows]);

  const run = (row: Row) => {
    if (row.kind === "organ") onOpenOrgan(row.organ.id);
    if (row.kind === "structure") onOpenStructure(row.organId, row.hotspotId);
    if (row.kind === "system") onOpenSystem(row.system);
    if (row.kind === "lesson") onStartLesson(row.organId);
    if (row.kind === "action") row.run();
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => (rows.length ? (value + 1) % rows.length : 0));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => (rows.length ? (value - 1 + rows.length) % rows.length : 0));
    }
    if (event.key === "Enter" && rows[active]) {
      event.preventDefault();
      run(rows[active]);
    }
  };

  const groupLabel: Record<Row["kind"], string> = {
    organ: t.search.organs,
    structure: t.search.structures,
    system: t.search.systems,
    lesson: t.search.lessons,
    action: t.search.actions,
  };

  return (
    <div className="palette-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label={t.command.open}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <label className="palette-input">
          <Search size={17} aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            placeholder={t.command.placeholder}
            aria-label={t.command.placeholder}
            role="combobox"
            aria-expanded
            aria-controls="palette-list"
            aria-activedescendant={rows[active]?.id}
          />
        </label>

        <div className="palette-list" id="palette-list" role="listbox" ref={listRef}>
          {rows.length === 0 && <p className="palette-empty">{t.search.noResults}</p>}
          {rows.map((row, index) => {
            const Icon = GROUP_ICON[row.kind];
            const previous = rows[index - 1];
            return (
              <div key={row.id}>
                {previous?.kind !== row.kind && <p className="palette-group">{groupLabel[row.kind]}</p>}
                <button
                  type="button"
                  id={row.id}
                  role="option"
                  aria-selected={index === active}
                  data-active={index === active}
                  className="palette-row"
                  onMouseMove={() => setCursor(index)}
                  onClick={() => run(row)}
                >
                  <span
                    className="palette-icon"
                    style={row.kind === "structure" ? ({ color: row.color } as React.CSSProperties) : undefined}
                  >
                    <Icon size={15} />
                  </span>
                  <span className="palette-label">
                    <b>{row.label}</b>
                    <small>{row.hint}</small>
                  </span>
                  <CornerDownLeft size={13} className="palette-enter" />
                </button>
              </div>
            );
          })}
        </div>

        <footer className="palette-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> {t.command.navigate}</span>
          <span><kbd>↵</kbd> {t.command.select}</span>
          <span><kbd>esc</kbd> {t.command.close}</span>
        </footer>
      </div>
    </div>
  );
}
