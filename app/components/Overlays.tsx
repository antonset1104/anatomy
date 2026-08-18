"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, Copy, GraduationCap, Link2, Lock, Search, Share2, Trophy } from "lucide-react";
import type { GlossaryEntry, Organ, System } from "../i18n/merge";
import { format, type UiDictionary } from "../i18n/types";
import type { OrganId } from "../lib/anatomy-data";
import { achievementIds, masteryPercent, type Prefs, type Progress } from "../lib/store";
import { totalStructures } from "../lib/anatomy-data";
import type { Lesson } from "../lib/lessons";
import { Modal, OrganArt, Ring, Segmented } from "./primitives";

export function SystemsSheet({
  t,
  systems,
  organs,
  onOpenOrgan,
  onClose,
}: {
  t: UiDictionary;
  systems: System[];
  organs: Organ[];
  onOpenOrgan: (id: OrganId) => void;
  onClose: () => void;
}) {
  return (
    <Modal title={t.systems.title} subtitle={t.systems.subtitle} closeLabel={t.common.close} onClose={onClose} size="lg">
      <div className="system-grid">
        {systems.map((system) => {
          const members = system.organs
            .map((id) => organs.find((organ) => organ.id === id))
            .filter((organ): organ is Organ => Boolean(organ));
          return (
            <article key={system.id} className="system-card" style={{ "--chip-accent": system.accent } as React.CSSProperties}>
              <header>
                <span className="system-glyph">{system.icon}</span>
                <div>
                  <h3>{system.name}</h3>
                  <small>{format(t.systems.organCount, { count: members.length })}</small>
                </div>
              </header>
              <p>{system.role}</p>
              <div className="system-members">
                {members.map((organ) => (
                  <button key={organ.id} type="button" onClick={() => onOpenOrgan(organ.id)}>
                    <span className="organ-glyph" style={{ "--item-accent": organ.accent } as React.CSSProperties}>
                      <OrganArt organ={organ} asset="thumb" alt="" size={34} />
                    </span>
                    {organ.name}
                    <ArrowRight size={12} />
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </Modal>
  );
}

export function GlossarySheet({
  t,
  locale,
  entries,
  onOpen,
  onClose,
}: {
  t: UiDictionary;
  locale: string;
  entries: GlossaryEntry[];
  onOpen: (organId: OrganId, hotspotId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    if (!needle) return entries;
    return entries.filter(({ organ, hotspot }) =>
      `${hotspot.label} ${hotspot.ta} ${hotspot.detail} ${organ.name}`.toLocaleLowerCase(locale).includes(needle),
    );
  }, [entries, query, locale]);

  return (
    <Modal title={t.glossary.title} subtitle={t.glossary.subtitle} closeLabel={t.common.close} onClose={onClose} size="lg">
      <label className="library-search wide">
        <Search size={14} aria-hidden />
        <input
          data-autofocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.glossary.placeholder}
          aria-label={t.glossary.placeholder}
        />
      </label>

      {filtered.length === 0 ? (
        <p className="muted-note">{t.glossary.empty}</p>
      ) : (
        <table className="glossary-table">
          <thead>
            <tr>
              <th>{t.glossary.term}</th>
              <th>{t.glossary.latin}</th>
              <th>{t.search.organs}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ organ, hotspot }) => (
              <tr key={`${organ.id}:${hotspot.id}`}>
                <td>
                  <button type="button" className="link-button" onClick={() => onOpen(organ.id, hotspot.id)}>
                    <span className="dot" style={{ background: hotspot.color }} aria-hidden />
                    {hotspot.label}
                  </button>
                  <small>{hotspot.detail}</small>
                </td>
                <td><i lang="la">{hotspot.ta}</i></td>
                <td>{organ.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

export function LessonsSheet({
  t,
  lessons,
  progress,
  onStart,
  onClose,
}: {
  t: UiDictionary;
  lessons: Lesson[];
  progress: Progress;
  onStart: (lesson: Lesson) => void;
  onClose: () => void;
}) {
  return (
    <Modal title={t.lessons.title} subtitle={t.lessons.subtitle} closeLabel={t.common.close} onClose={onClose} size="lg">
      <div className="lesson-grid">
        {lessons.map((lesson) => {
          const done = progress.lessonsDone.includes(lesson.id);
          return (
            <button key={lesson.id} type="button" className={`lesson-card ${done ? "done" : ""}`} onClick={() => onStart(lesson)}>
              <span className="lesson-icon">{done ? <Check size={15} /> : <GraduationCap size={15} />}</span>
              <b>{lesson.title}</b>
              <small>{lesson.subtitle}</small>
              <i>{format(t.lessons.duration, { count: lesson.steps.length })}</i>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

export function ProgressSheet({
  t,
  progress,
  organs,
  onReset,
  onClose,
}: {
  t: UiDictionary;
  progress: Progress;
  organs: Organ[];
  onReset: () => void;
  onClose: () => void;
}) {
  const mastery = masteryPercent(progress);
  const stats = [
    { label: t.progress.visited, value: `${progress.visited.length}/${organs.length}` },
    { label: t.progress.structuresLearned, value: `${progress.learned.length}/${totalStructures}` },
    { label: t.progress.quizzes, value: String(progress.quizzes.taken) },
    { label: t.progress.bestScore, value: `${progress.quizzes.best}%` },
    {
      label: t.progress.streak,
      value: format(
        progress.streak.count === 1 ? t.progress.streakUnitOne : t.progress.streakUnit,
        { count: progress.streak.count },
      ),
    },
    { label: t.lessons.title, value: String(progress.lessonsDone.length) },
  ];

  return (
    <Modal title={t.progress.title} subtitle={t.progress.subtitle} closeLabel={t.common.close} onClose={onClose} size="lg">
      <div className="progress-head">
        <Ring percent={mastery} label={t.progress.mastery} />
        <dl className="stat-grid">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt>{stat.label}</dt>
              <dd><bdi dir="ltr">{stat.value}</bdi></dd>
            </div>
          ))}
        </dl>
      </div>

      <h3 className="panel-label">{t.progress.achievements}</h3>
      <div className="badge-grid">
        {achievementIds.map((id) => {
          const earned = progress.achievements.includes(id);
          const copy = t.achievements[id];
          return (
            <div key={id} className={`badge ${earned ? "earned" : ""}`}>
              <span>{earned ? <Trophy size={15} /> : <Lock size={13} />}</span>
              <b>{copy?.name ?? id}</b>
              <small>{earned ? copy?.hint : t.progress.locked}</small>
            </div>
          );
        })}
      </div>

      <button type="button" className="ghost-button danger" onClick={onReset}>{t.progress.reset}</button>
    </Modal>
  );
}

export function SettingsSheet({
  t,
  prefs,
  onChange,
  onClose,
}: {
  t: UiDictionary;
  prefs: Prefs;
  onChange: (patch: Partial<Prefs>) => void;
  onClose: () => void;
}) {
  return (
    <Modal title={t.settings.title} subtitle={t.settings.subtitle} closeLabel={t.settings.close} onClose={onClose} size="sm">
      <div className="setting-row">
        <div>
          <b>{t.theme.label}</b>
        </div>
        <Segmented
          label={t.theme.label}
          value={prefs.theme}
          onChange={(theme) => onChange({ theme })}
          options={[
            { value: "system", label: t.theme.system },
            { value: "light", label: t.theme.light },
            { value: "dark", label: t.theme.dark },
          ]}
        />
      </div>

      <div className="setting-row">
        <div>
          <b>{t.settings.quality}</b>
        </div>
        <Segmented
          label={t.settings.quality}
          value={prefs.quality}
          onChange={(quality) => onChange({ quality })}
          options={[
            { value: "auto", label: t.settings.qualityAuto },
            { value: "high", label: t.settings.qualityHigh },
            { value: "low", label: t.settings.qualityLow },
          ]}
        />
      </div>

      <div className="setting-row">
        <div>
          <b>{t.settings.textSize}</b>
        </div>
        <Segmented
          label={t.settings.textSize}
          value={prefs.textSize}
          onChange={(textSize) => onChange({ textSize })}
          options={[
            { value: "sm", label: t.settings.textSmall },
            { value: "md", label: t.settings.textNormal },
            { value: "lg", label: t.settings.textLarge },
          ]}
        />
      </div>

      <label className="setting-toggle">
        <input
          type="checkbox"
          checked={prefs.reduceMotion}
          onChange={(event) => onChange({ reduceMotion: event.target.checked })}
        />
        <span>
          <b>{t.settings.motion}</b>
          <small>{t.settings.motionBody}</small>
        </span>
      </label>

      <label className="setting-toggle">
        <input
          type="checkbox"
          checked={prefs.alwaysLabels}
          onChange={(event) => onChange({ alwaysLabels: event.target.checked })}
        />
        <span>
          <b>{t.settings.labelsAlways}</b>
          <small>{t.settings.labelsAlwaysBody}</small>
        </span>
      </label>
    </Modal>
  );
}

export function ShareSheet({ t, url, onClose }: { t: UiDictionary; url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const canShareNatively = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <Modal title={t.share.title} subtitle={t.share.body} closeLabel={t.common.close} onClose={onClose} size="sm">
      <label className="share-field">
        <Link2 size={14} aria-hidden />
        <input readOnly value={url} aria-label={t.share.copy} onFocus={(event) => event.target.select()} />
      </label>
      <div className="note-actions">
        <button
          type="button"
          className="button-primary"
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            });
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t.share.copied : t.share.copy}
        </button>
        {canShareNatively && (
          <button
            type="button"
            className="ghost-button"
            onClick={() => void navigator.share({ url }).catch(() => {})}
          >
            <Share2 size={14} /> {t.share.native}
          </button>
        )}
      </div>
    </Modal>
  );
}
