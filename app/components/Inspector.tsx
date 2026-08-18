"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Check,
  CircleHelp,
  Crosshair,
  Download,
  FileText,
  GraduationCap,
  Layers3,
  Printer,
  Share2,
  Sparkles,
  Stethoscope,
  Trash2,
} from "lucide-react";
import type { Hotspot, Organ } from "../i18n/merge";
import { format, type UiDictionary } from "../i18n/types";
import type { OrganId } from "../lib/anatomy-data";
import type { Progress } from "../lib/store";
import { organMastery } from "../lib/store";
import { Measure, MetricBar, OrganArt, Ring } from "./primitives";

export type Tab = "overview" | "structures" | "clinical" | "physiology" | "notes";

const LAYER_ORDER = ["surface", "chamber", "vessel", "duct", "nerve", "deep"] as const;

/**
 * Mounted with a `key` per specimen, so the draft seeds itself from the saved
 * note instead of being resynced by an effect every time the organ changes.
 */
function NoteEditor({
  t,
  saved,
  noteCount,
  onSave,
  onExport,
}: {
  t: UiDictionary;
  saved: string;
  noteCount: number;
  onSave: (text: string) => void;
  onExport: () => void;
}) {
  const [draft, setDraft] = useState(saved);
  const [justSaved, setJustSaved] = useState(false);

  return (
    <>
      <h2>{t.notes.title}</h2>
      <textarea
        className="note-input"
        value={draft}
        placeholder={t.notes.placeholder}
        rows={7}
        onChange={(event) => {
          setDraft(event.target.value);
          setJustSaved(false);
        }}
      />
      <div className="note-actions">
        <button
          type="button"
          className="button-primary"
          onClick={() => {
            onSave(draft);
            setJustSaved(true);
          }}
        >
          {justSaved ? t.notes.saved : t.notes.save}
        </button>
        {saved && (
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setDraft("");
              onSave("");
            }}
          >
            <Trash2 size={14} /> {t.notes.clear}
          </button>
        )}
      </div>
      <div className="note-meta">
        <span>{format(t.notes.count, { count: noteCount })}</span>
        <button type="button" className="link-button" onClick={onExport}>
          <Download size={13} /> {t.notes.export}
        </button>
      </div>
      {!saved && <p className="muted-note">{t.notes.empty}</p>}
    </>
  );
}

export function Inspector({
  t,
  organ,
  organs,
  progress,
  selectedHotspotId,
  onSelectHotspot,
  onToggleLearned,
  onToggleBookmark,
  onOpenOrgan,
  onStartLesson,
  onStartQuiz,
  onCompare,
  onShare,
  onPrint,
  onSaveNote,
  onExportNotes,
  compare,
  tab,
  onTab,
}: {
  t: UiDictionary;
  organ: Organ;
  organs: Organ[];
  progress: Progress;
  selectedHotspotId: string | null;
  onSelectHotspot: (hotspot: Hotspot, focus: boolean) => void;
  onToggleLearned: (hotspotId: string) => void;
  onToggleBookmark: () => void;
  onOpenOrgan: (id: OrganId) => void;
  onStartLesson: () => void;
  onStartQuiz: () => void;
  onCompare: () => void;
  onShare: () => void;
  onPrint: () => void;
  onSaveNote: (text: string) => void;
  onExportNotes: () => void;
  compare: boolean;
  /** Owned by the shell so selecting a structure elsewhere can switch tabs. */
  tab: Tab;
  onTab: (tab: Tab) => void;
}) {
  const [layer, setLayer] = useState<string>("all");
  const savedNote = progress.notes[organ.id]?.text ?? "";

  const bookmarked = progress.bookmarks.includes(organ.id);
  const mastery = organMastery(progress, organ.id, organ.hotspots.length);
  const learnedSet = useMemo(
    () => new Set(progress.learned.filter((key) => key.startsWith(`${organ.id}:`)).map((key) => key.split(":")[1])),
    [progress.learned, organ.id],
  );

  const layers = useMemo(() => {
    const present = new Set(organ.hotspots.map((hotspot) => hotspot.layer));
    return LAYER_ORDER.filter((name) => present.has(name));
  }, [organ.hotspots]);

  const visibleHotspots = layer === "all" ? organ.hotspots : organ.hotspots.filter((hotspot) => hotspot.layer === layer);
  const related = organ.related.map((id) => organs.find((item) => item.id === id)).filter((item): item is Organ => Boolean(item));

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: t.inspector.overview },
    { id: "structures", label: t.inspector.structures },
    { id: "physiology", label: t.inspector.physiology },
    { id: "clinical", label: t.inspector.clinical },
    { id: "notes", label: t.inspector.notes },
  ];

  return (
    <aside className="info-panel" aria-label={format(t.info.kicker, { organ: organ.name })}>
      <header className="info-head">
        <div className="info-kicker">
          <span className="difficulty-chip" data-level={organ.difficulty}>{t.difficulty[organ.difficulty]}</span>
          <span>{organ.system}</span>
        </div>
        <div className="info-title-row">
          <div>
            <h1>{organ.name}</h1>
            <em>{organ.poetic}</em>
          </div>
          <span className="specimen-stamp">
            <OrganArt organ={organ} asset="organ" alt="" size={84} />
          </span>
        </div>
        <div className="info-head-actions">
          <button
            type="button"
            className={`chip-button ${bookmarked ? "active" : ""}`}
            onClick={onToggleBookmark}
            aria-pressed={bookmarked}
          >
            {bookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
            {bookmarked ? t.bookmarks.remove : t.bookmarks.add}
          </button>
          <button type="button" className="chip-button" onClick={onShare}>
            <Share2 size={14} /> {t.share.label}
          </button>
          <button type="button" className="chip-button" onClick={onPrint}>
            <Printer size={14} /> {t.print.button}
          </button>
        </div>
      </header>

      <nav className="tab-bar" aria-label={t.inspector.overview}>
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            className={tab === entry.id ? "active" : ""}
            onClick={() => onTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      <div className="tab-body">
        {tab === "overview" && (
          <>
            <p className="description">{organ.description}</p>
            <div className="mastery-row">
              <Ring percent={mastery} label={t.info.mastery} accent={organ.accent} />
              <div>
                <span className="panel-label">{t.info.mastery}</span>
                <p>{format(t.structures.count, { count: organ.hotspots.length })}</p>
                <button type="button" className="link-button" onClick={onStartLesson}>
                  <GraduationCap size={14} /> {t.info.startLesson}
                </button>
              </div>
            </div>

            <h2>{t.info.keyFacts}</h2>
            <dl className="key-facts">
              <div><dt><span>◇</span> {t.info.size}</dt><dd><Measure>{organ.size}</Measure></dd></div>
              <div><dt><span>♙</span> {t.info.weight}</dt><dd><Measure>{organ.weight}</Measure></dd></div>
              <div><dt><span>⌁</span> {t.info.daily}</dt><dd><Measure>{organ.dailyFact}</Measure></dd></div>
              <div><dt><span>⌖</span> {t.info.location}</dt><dd><Measure>{organ.location}</Measure></dd></div>
              <div><dt><span>❋</span> {t.info.bloodSupply}</dt><dd><Measure>{organ.bloodSupply}</Measure></dd></div>
              <div><dt><span>◈</span> {t.info.function}</dt><dd><Measure>{organ.function}</Measure></dd></div>
            </dl>

            <div className="fun-note">
              <Sparkles size={15} />
              <p><b>{t.info.didYouKnow}</b>{organ.funFact}</p>
            </div>

            {related.length > 0 && (
              <>
                <h2>{t.info.related}</h2>
                <div className="related-row">
                  {related.map((item) => (
                    <button key={item.id} type="button" className="related-card" onClick={() => onOpenOrgan(item.id)}>
                      <span className="organ-glyph" style={{ "--item-accent": item.accent } as React.CSSProperties}>
                        <OrganArt organ={item} asset="thumb" alt="" size={38} />
                      </span>
                      <b>{item.name}</b>
                      <ArrowRight size={13} />
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="action-grid">
              <button type="button" onClick={onStartLesson}><GraduationCap size={15} /> {t.info.viewLesson}</button>
              <button type="button" onClick={onStartQuiz}><CircleHelp size={15} /> {t.info.quiz}</button>
              <button type="button" onClick={onCompare} className={compare ? "active" : ""}>
                <Share2 size={15} /> {t.info.compare}
              </button>
            </div>
          </>
        )}

        {tab === "structures" && (
          <>
            <div className="layer-filter" role="group" aria-label={t.structures.layerAll}>
              <button type="button" className={layer === "all" ? "active" : ""} onClick={() => setLayer("all")}>
                {t.structures.layerAll}
              </button>
              {layers.map((name) => (
                <button key={name} type="button" className={layer === name ? "active" : ""} onClick={() => setLayer(name)}>
                  {t.structures[name]}
                </button>
              ))}
            </div>

            <ul className="structure-list">
              {visibleHotspots.map((hotspot) => {
                const learned = learnedSet.has(hotspot.id);
                return (
                  <li
                    key={hotspot.id}
                    className={selectedHotspotId === hotspot.id ? "active" : ""}
                    style={{ "--dot": hotspot.color } as React.CSSProperties}
                  >
                    <button type="button" className="structure-main" onClick={() => onSelectHotspot(hotspot, true)}>
                      <b>{hotspot.label}</b>
                      <small>{hotspot.detail}</small>
                      <i>{hotspot.ta}</i>
                    </button>
                    <div className="structure-side">
                      <button
                        type="button"
                        className={`tick ${learned ? "on" : ""}`}
                        aria-pressed={learned}
                        title={learned ? t.structures.learned : t.structures.markLearned}
                        onClick={() => onToggleLearned(hotspot.id)}
                      >
                        <Check size={13} />
                      </button>
                      <button
                        type="button"
                        className="tick"
                        title={t.structures.focus}
                        onClick={() => onSelectHotspot(hotspot, true)}
                      >
                        <Crosshair size={13} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {tab === "physiology" && (
          <>
            <h2>{t.physiology.title}</h2>
            <p className="muted-note">{t.physiology.subtitle}</p>
            {organ.metrics.length === 0 ? (
              <p className="muted-note">{t.physiology.noData}</p>
            ) : (
              <div className="metric-stack">
                {organ.metrics.map((metric) => (
                  <MetricBar
                    key={metric.id}
                    label={metric.label}
                    value={metric.value}
                    max={metric.max}
                    unit={metric.unit}
                    band={metric.band}
                    accent={organ.accent}
                    rangeLabel={
                      metric.band
                        ? format(t.physiology.healthyRange, { low: metric.band[0], high: metric.band[1], unit: metric.unit })
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "clinical" && (
          <>
            <div className="medical-note">
              <Stethoscope size={16} />
              <p><b>{t.clinical.note}</b>{organ.medical}</p>
            </div>
            <h2>{t.clinical.conditions}</h2>
            <ul className="condition-list">
              {organ.conditions.map((condition) => (
                <li key={condition}><FileText size={13} /> {condition}</li>
              ))}
            </ul>
            <h2>{t.clinical.tissue}</h2>
            <div className="tissue-row">
              <span className="microscope-visual">
                <OrganArt organ={organ} asset="microscopic" alt="" size={72} />
              </span>
              <p>{organ.tissue}</p>
            </div>
            <p className="disclaimer"><Layers3 size={12} /> {t.clinical.disclaimer}</p>
          </>
        )}

        {tab === "notes" && (
          <NoteEditor
            key={organ.id}
            t={t}
            saved={savedNote}
            noteCount={Object.keys(progress.notes).length}
            onSave={onSaveNote}
            onExport={onExportNotes}
          />
        )}
      </div>
    </aside>
  );
}
