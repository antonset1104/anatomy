"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import gsap from "gsap";
import { ArrowRight, GraduationCap, Microscope, Play, Share2, Sparkles } from "lucide-react";
import { OrganViewer, type ViewerHandle } from "./OrganViewer";
import { SpecimenLibrary } from "./SpecimenLibrary";
import { Inspector, type Tab } from "./Inspector";
import { TopBar, type TopBarView } from "./TopBar";
import { CommandPalette, type CommandAction } from "./CommandPalette";
import { LessonPlayer } from "./LessonPlayer";
import { QuizLauncher, QuizSession, type QuizConfig } from "./QuizSession";
import { CompareView } from "./CompareView";
import { GlossarySheet, LessonsSheet, ProgressSheet, SettingsSheet, ShareSheet, SystemsSheet } from "./Overlays";
import { ToastStack, useToasts } from "./Toasts";
import { Measure, OrganArt } from "./primitives";
import type { OrganId } from "../lib/anatomy-data";
import type { LocaleConfig } from "../i18n/config";
import { buildGlossary, buildOrgans, buildSystems, indexOrgans, type Hotspot, type Organ } from "../i18n/merge";
import { format, type Dictionary } from "../i18n/types";
import { actions, hydrate, masteryPercent, newAchievements, subscribeToStore, useStore, type Prefs } from "../lib/store";
import { buildGrandTour, buildLessons, type Lesson } from "../lib/lessons";
import { readDeepLink, shareUrl, writeDeepLink, type ViewName } from "../lib/url-state";

type Sheet = "systems" | "glossary" | "lessons" | "progress" | "settings" | "share" | "quiz" | null;

/**
 * The OS colour-scheme query, read as an external store. Cached because
 * `matchMedia` hands back a fresh object each call, and a listener removed from
 * a different object than it was added to simply leaks.
 */
let darkQuery: MediaQueryList | null = null;

function getDarkQuery() {
  darkQuery ??= window.matchMedia("(prefers-color-scheme: dark)");
  return darkQuery;
}

function subscribeSystemDark(onChange: () => void) {
  const query = getDarkQuery();
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Resolves `system` against the OS preference, and keeps following it. */
function useResolvedTheme(preference: Prefs["theme"]) {
  const systemDark = useSyncExternalStore(
    subscribeSystemDark,
    () => getDarkQuery().matches,
    () => false,
  );
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}

export function AnatomyApp({ locale, dictionary }: { locale: LocaleConfig; dictionary: Dictionary }) {
  const t = dictionary.ui;
  const organs = useMemo(() => buildOrgans(dictionary.organs, t), [dictionary.organs, t]);
  const organById = useMemo(() => indexOrgans(organs), [organs]);
  const systems = useMemo(() => buildSystems(t), [t]);
  const glossary = useMemo(() => buildGlossary(organs), [organs]);
  const lessons = useMemo(
    () => [buildGrandTour(organs, t.lessons.tourTitle, t.lessons.tourBody), ...buildLessons(organs)],
    [organs, t.lessons.tourTitle, t.lessons.tourBody],
  );

  const { progress, prefs, hydrated } = useStore();
  const theme = useResolvedTheme(prefs.theme);
  const { toasts, push } = useToasts();

  const [organId, setOrganId] = useState<OrganId>("heart");
  const [compareId, setCompareId] = useState<OrganId>("brain");
  const [autoRotate, setAutoRotate] = useState(true);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [mobileLibrary, setMobileLibrary] = useState(false);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [quiz, setQuiz] = useState<QuizConfig | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [lastView, setLastView] = useState<ViewName>("anterior");
  const [inspectorTab, setInspectorTab] = useState<Tab>("overview");

  const viewerRef = useRef<ViewerHandle>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const prefetched = useRef(new Set<OrganId>());
  const quizPickRef = useRef<(hotspot: Hotspot) => void>(() => {});
  /**
   * A structure to focus once a specimen switch currently in flight finishes
   * loading. `onOrganReady` (fired from the real load-complete event, not a
   * guessed delay) below consumes this — see the comment on that prop in
   * `OrganViewer.tsx` for why a fixed timeout was not good enough here: on a
   * slow connection a GLB can easily take longer than any delay short enough
   * to not feel sluggish on a fast one, and a hotspot that never gets selected
   * is a silent miss, not an error.
   */
  const pendingFocusRef = useRef<{ organId: OrganId; hotspotId: string } | null>(null);
  const onOrganReady = useCallback((readyOrganId: OrganId) => {
    const pending = pendingFocusRef.current;
    if (pending?.organId !== readyOrganId) return;
    pendingFocusRef.current = null;
    viewerRef.current?.selectHotspot(pending.hotspotId, true);
  }, []);

  // Reduced motion is folded in here rather than pushed into state, so the
  // learner's own toggle survives turning the preference back off.
  const spinning = autoRotate && !prefs.reduceMotion;
  const organ = organById[organId];
  const compareOrgan = organById[compareId];

  useEffect(() => hydrate(), []);

  // Restore a shared link once, after hydration, so it wins over the default
  // specimen but never fights the learner's own navigation afterwards. Applied
  // in a microtask rather than inline: the server rendered the default
  // specimen, so moving during commit would fight hydration.
  useEffect(() => {
    queueMicrotask(() => {
      const link = readDeepLink(window.location.search);
      if (link.organ) setOrganId(link.organ);
      if (link.view) setLastView(link.view);
      // Consumed by `onOrganReady` once that specimen's model actually
      // finishes loading — see the comment on `pendingFocusRef` above.
      if (link.organ && link.hotspot) {
        pendingFocusRef.current = { organId: link.organ, hotspotId: link.hotspot };
      }
    });
  }, []);

  useEffect(() => {
    if (hydrated) actions.visit(organId);
  }, [organId, hydrated]);

  useEffect(() => {
    writeDeepLink({ organ: organId, hotspot: selectedHotspot?.id ?? null, view: lastView });
  }, [organId, selectedHotspot, lastView]);

  // Theme, text size, and the motion preference are document-level, so they are
  // applied to the root rather than threaded through every component.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.text = prefs.textSize;
    document.documentElement.dataset.motion = prefs.reduceMotion ? "reduced" : "full";
  }, [theme, prefs.textSize, prefs.reduceMotion]);

  // Badges announce themselves once, wherever they were earned. Driven from the
  // store subscription rather than an effect on `progress`, so the toast lands
  // on the notification instead of on a render pass.
  useEffect(
    () =>
      subscribeToStore(() => {
        if (!newAchievements.length) return;
        const earned = newAchievements.splice(0, newAchievements.length);
        earned.forEach((id) => push(t.achievements[id]?.name ?? id, "award"));
      }),
    [push, t.achievements],
  );

  useEffect(() => {
    if (!contentRef.current || prefs.reduceMotion) return;
    gsap.fromTo(
      contentRef.current.querySelectorAll("[data-reveal]"),
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.48, stagger: 0.035, ease: "power2.out", overwrite: true },
    );
  }, [organId, prefs.reduceMotion]);

  const selectOrgan = useCallback(
    (id: OrganId) => {
      if (organById[id].illustrated) {
        ["organ", "microscopic", "compare", "location"].forEach((asset) => {
          const image = new Image();
          image.src = `/anatomy/${id}/${asset}.webp`;
        });
      }
      setOrganId(id);
      setMobileLibrary(false);
      setSelectedHotspot(null);
      setQuiz(null);
    },
    [organById],
  );

  // Warms the model in the HTTP cache while the pointer is still travelling,
  // so the switch usually renders without a visible loading pass.
  const prefetchOrgan = useCallback(
    (id: OrganId) => {
      if (id === organId || prefetched.current.has(id)) return;
      prefetched.current.add(id);
      void fetch(organById[id].model, { priority: "low" } as RequestInit).catch(() => {});
    },
    [organId, organById],
  );

  const openStructure = useCallback(
    (targetOrgan: OrganId, hotspotId: string) => {
      if (targetOrgan !== organId) {
        // Consumed by `onOrganReady` once the new specimen's model has
        // actually finished loading, not after a guessed delay.
        pendingFocusRef.current = { organId: targetOrgan, hotspotId };
        selectOrgan(targetOrgan);
      } else {
        viewerRef.current?.selectHotspot(hotspotId, true);
      }
    },
    [organId, selectOrgan],
  );

  const startLesson = useCallback(
    (target: Lesson) => {
      setQuiz(null);
      setSheet(null);
      setLesson(target);
      if (target.organId && target.organId !== organId) selectOrgan(target.organId);
    },
    [organId, selectOrgan],
  );

  const exportNotes = useCallback(() => {
    const lines = Object.entries(progress.notes).map(([id, note]) => {
      const name = organById[id as OrganId]?.name ?? id;
      return `## ${name}\n\n${note.text}\n`;
    });
    const blob = new Blob([`# ${t.notes.title}\n\n${lines.join("\n")}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "anatomy-atelier-notes.md";
    link.click();
    URL.revokeObjectURL(url);
  }, [progress.notes, organById, t.notes.title]);

  // ⌘K / Ctrl+K everywhere, plus a couple of single-key jumps that stay out of
  // the way of typing.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "/") {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key === "?") setSheet("glossary");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const paletteActions = useMemo<CommandAction[]>(
    () => [
      { id: "systems", label: t.systems.open, run: () => setSheet("systems") },
      { id: "glossary", label: t.glossary.title, run: () => setSheet("glossary") },
      { id: "lessons", label: t.lessons.title, run: () => setSheet("lessons") },
      { id: "progress", label: t.progress.title, run: () => setSheet("progress") },
      { id: "settings", label: t.settings.title, run: () => setSheet("settings") },
      { id: "quiz", label: t.quiz.chooseMode, run: () => setSheet("quiz") },
      { id: "compare", label: t.compare.open, run: () => setCompareOpen(true) },
      { id: "share", label: t.share.label, run: () => setSheet("share") },
      { id: "print", label: t.print.button, run: () => window.print() },
      {
        id: "theme",
        label: `${t.theme.label}: ${theme === "dark" ? t.theme.light : t.theme.dark}`,
        run: () => actions.setPrefs({ theme: theme === "dark" ? "light" : "dark" }),
      },
    ],
    [t, theme],
  );

  const onNav = (view: TopBarView) => {
    if (view === "explore") viewerRef.current?.reset();
    else setSheet(view);
  };

  return (
    <>
      <a className="skip-link" href="#specimen-stage">{t.brand.skip}</a>

      <main className="app-shell">
        <TopBar
          t={t}
          locale={locale}
          prefs={prefs}
          streak={progress.streak.count}
          mastery={masteryPercent(progress)}
          onCommand={() => setPaletteOpen(true)}
          onNav={onNav}
          onTheme={(next) => actions.setPrefs({ theme: next })}
          onSettings={() => setSheet("settings")}
          onOpenLibrary={() => setMobileLibrary(true)}
          onHome={() => selectOrgan("heart")}
        />

        <div className="workspace" id="specimen-stage">
          <SpecimenLibrary
            t={t}
            locale={locale.code}
            organs={organs}
            systems={systems}
            progress={progress}
            activeId={organId}
            open={mobileLibrary}
            onSelect={selectOrgan}
            onPrefetch={prefetchOrgan}
            onClose={() => setMobileLibrary(false)}
          />

          <OrganViewer
            organ={organ}
            t={t}
            handleRef={viewerRef}
            autoRotate={spinning}
            onAutoRotate={setAutoRotate}
            compare={compareOpen}
            onCompare={() => setCompareOpen(true)}
            quizActive={quiz?.mode === "label"}
            theme={theme}
            quality={prefs.quality}
            alwaysLabels={prefs.alwaysLabels}
            onPick={(hotspot) => quizPickRef.current(hotspot)}
            onSelect={(hotspot) => {
              setSelectedHotspot(hotspot);
              // A structure the learner just picked should be visible in the
              // panel too, wherever the click came from.
              if (hotspot) setInspectorTab("structures");
            }}
            onToast={(text) => push(text, "success")}
            onOrganReady={onOrganReady}
            overlayActive={Boolean(lesson) || Boolean(quiz)}
          >
            {lesson && (
              <LessonPlayer
                key={lesson.id}
                t={t}
                lesson={lesson}
                reduceMotion={prefs.reduceMotion}
                onStep={(stepOrgan, hotspotId) => {
                  if (stepOrgan !== organId) {
                    // A single slot, not a queue: stepping through the grand
                    // tour faster than a model can load should focus wherever
                    // the learner actually ended up, not replay every stop
                    // along the way once each one's load eventually catches up.
                    pendingFocusRef.current = { organId: stepOrgan, hotspotId };
                    selectOrgan(stepOrgan);
                  } else {
                    viewerRef.current?.selectHotspot(hotspotId, true);
                  }
                  actions.markLearned(stepOrgan, hotspotId);
                }}
                onComplete={() => actions.completeLesson(lesson.id)}
                onExit={() => setLesson(null)}
              />
            )}

            {quiz && (
              <QuizSession
                key={`${quiz.mode}-${quiz.scope}-${organId}`}
                t={t}
                config={quiz}
                organ={organ}
                organs={organs}
                pickRef={quizPickRef}
                flash={(id, correct) => viewerRef.current?.flash(id, correct)}
                screenY={(id) => viewerRef.current?.screenY(id) ?? null}
                onLearned={(target, hotspotId) => actions.markLearned(target, hotspotId)}
                onFinish={(score, total) => actions.recordQuiz(score, total)}
                onExit={() => setQuiz(null)}
              />
            )}
          </OrganViewer>

          <div ref={contentRef} className="inspector-wrap">
            <Inspector
              t={t}
              organ={organ}
              organs={organs}
              progress={progress}
              selectedHotspotId={selectedHotspot?.id ?? null}
              onSelectHotspot={(hotspot, focus) => viewerRef.current?.selectHotspot(hotspot.id, focus)}
              onToggleLearned={(hotspotId) => actions.toggleLearned(organId, hotspotId)}
              onToggleBookmark={() => {
                const added = actions.toggleBookmark(organId);
                push(added ? t.bookmarks.added : t.bookmarks.removed, "success");
              }}
              onOpenOrgan={selectOrgan}
              onStartLesson={() => startLesson(lessons.find((item) => item.organId === organId) ?? lessons[0])}
              onStartQuiz={() => setSheet("quiz")}
              onCompare={() => setCompareOpen(true)}
              onShare={() => setSheet("share")}
              onPrint={() => window.print()}
              onSaveNote={(text) => actions.saveNote(organId, text)}
              onExportNotes={exportNotes}
              compare={compareOpen}
              tab={inspectorTab}
              onTab={setInspectorTab}
            />
          </div>
        </div>

        <section className="learning-cards" aria-label={format(t.cards.resources, { organ: organ.name })}>
          <article className="curiosity-card">
            <span>✿</span>
            <p>{t.library.quoteLine1}<br />{t.library.quoteLine2}</p>
            <em>{t.library.quoteSign}</em>
          </article>

          <article>
            <header>
              <div><em>{t.cards.microscopic}</em><h3>{organ.tissue}</h3></div>
              <Microscope size={16} />
            </header>
            <div className="microscope-visual organ-card-image"><OrganArt organ={organ} asset="microscopic" alt="" /></div>
            <button type="button" onClick={() => setSheet("glossary")}>{t.cards.exploreTissue} <ArrowRight size={13} /></button>
          </article>

          <article>
            <header>
              <div><em>{t.cards.compareOrgans}</em><h3>{organ.comparison}</h3></div>
              <Share2 size={16} />
            </header>
            <div className="comparison-visual organ-card-image"><OrganArt organ={organ} asset="compare" alt="" /></div>
            <button type="button" onClick={() => setCompareOpen(true)}>{t.cards.openComparison} <ArrowRight size={13} /></button>
          </article>

          <article>
            <header>
              <div><em>{t.lessons.title}</em><h3>{organ.function}</h3></div>
              <Play size={16} />
            </header>
            {/* The artwork itself is the control, so the play badge inside it is
                decorative rather than a nested button. */}
            <button
              type="button"
              className="function-visual organ-card-image"
              onClick={() => startLesson(lessons.find((item) => item.organId === organId) ?? lessons[0])}
              aria-label={format(t.cards.playAria, { organ: organ.name })}
            >
              <OrganArt organ={organ} asset="organ" alt="" />
              <i className="function-pulse" />
              <span className="play-badge"><Play size={17} fill="currentColor" /></span>
            </button>
            <button type="button" onClick={() => startLesson(lessons.find((item) => item.organId === organId) ?? lessons[0])}>
              {t.lessons.start} <ArrowRight size={13} />
            </button>
          </article>

          <article>
            <header>
              <div><em>{t.cards.clinicalNotes}</em><h3>{t.cards.commonConditions}</h3></div>
              <Sparkles size={16} />
            </header>
            <ul>{organ.conditions.slice(0, 5).map((condition) => <li key={condition}>{condition}</li>)}</ul>
            <button type="button" onClick={() => setSheet("quiz")}>{t.quiz.chooseMode} <ArrowRight size={13} /></button>
          </article>

          <article className="system-card">
            <header>
              <div><em>{t.cards.whereItWorks}</em><h3>{organ.system}</h3></div>
              <GraduationCap size={16} />
            </header>
            <button
              type="button"
              className="system-visual organ-card-image"
              onClick={() => setSheet("systems")}
              aria-label={format(t.cards.systemAria, { organ: organ.name })}
            >
              <OrganArt organ={organ} asset="location" alt="" />
            </button>
            <button type="button" onClick={() => setSheet("systems")}>{t.cards.seeSystem} <ArrowRight size={13} /></button>
          </article>
        </section>
      </main>

      {/* Only rendered by the printer. Everything a learner needs on paper, in
          the order they would revise it. */}
      <section className="study-sheet" aria-hidden>
        {/* Deliberately not an h1: the inspector already owns the page's single
            top-level heading, and a second one only ever reaches a printer. */}
        <p className="study-title">{format(t.print.title, { organ: organ.name })}</p>
        <p className="study-meta">{t.print.source} · {organ.scientificName} · {organ.system}</p>
        <p>{organ.description}</p>
        <dl>
          <div><dt>{t.info.size}</dt><dd><Measure>{organ.size}</Measure></dd></div>
          <div><dt>{t.info.weight}</dt><dd><Measure>{organ.weight}</Measure></dd></div>
          <div><dt>{t.info.location}</dt><dd><Measure>{organ.location}</Measure></dd></div>
          <div><dt>{t.info.bloodSupply}</dt><dd><Measure>{organ.bloodSupply}</Measure></dd></div>
          <div><dt>{t.info.function}</dt><dd><Measure>{organ.function}</Measure></dd></div>
        </dl>
        <h2>{t.structures.title}</h2>
        <ol>
          {organ.hotspots.map((hotspot) => (
            <li key={hotspot.id}><b>{hotspot.label}</b> — {hotspot.detail} <i>({hotspot.ta})</i></li>
          ))}
        </ol>
        <h2>{t.clinical.conditions}</h2>
        <ul>{organ.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul>
        {progress.notes[organId] && (
          <>
            <h2>{t.notes.title}</h2>
            <p>{progress.notes[organId].text}</p>
          </>
        )}
        <p className="study-meta">{t.clinical.disclaimer}</p>
      </section>

      {paletteOpen && (
        <CommandPalette
          t={t}
          locale={locale.code}
          organs={organs}
          systems={systems}
          actions={paletteActions}
          onOpenOrgan={selectOrgan}
          onOpenStructure={openStructure}
          onOpenSystem={(system) => selectOrgan(system.organs[0])}
          onStartLesson={(id) => startLesson(lessons.find((item) => item.organId === id) ?? lessons[0])}
          onClose={() => setPaletteOpen(false)}
        />
      )}

      {sheet === "systems" && (
        <SystemsSheet
          t={t}
          systems={systems}
          organs={organs}
          onOpenOrgan={(id) => {
            selectOrgan(id);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "glossary" && (
        <GlossarySheet
          t={t}
          locale={locale.code}
          entries={glossary}
          onOpen={(target, hotspotId) => {
            openStructure(target, hotspotId);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "lessons" && (
        <LessonsSheet t={t} lessons={lessons} progress={progress} onStart={startLesson} onClose={() => setSheet(null)} />
      )}

      {sheet === "progress" && (
        <ProgressSheet
          t={t}
          progress={progress}
          organs={organs}
          onReset={() => {
            actions.resetProgress();
            push(t.progress.resetDone, "info");
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "settings" && (
        <SettingsSheet t={t} prefs={prefs} onChange={(patch) => actions.setPrefs(patch)} onClose={() => setSheet(null)} />
      )}

      {sheet === "share" && (
        <ShareSheet
          t={t}
          url={shareUrl({ organ: organId, hotspot: selectedHotspot?.id ?? null, view: lastView })}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "quiz" && (
        <QuizLauncher
          t={t}
          organ={organ}
          onClose={() => setSheet(null)}
          onStart={(config) => {
            setLesson(null);
            setSheet(null);
            setQuiz(config);
          }}
        />
      )}

      {compareOpen && (
        <CompareView
          t={t}
          organs={organs}
          left={organ}
          right={compareOrgan.id === organ.id ? organById[organ.related[0] ?? "brain"] : compareOrgan}
          theme={theme}
          quality={prefs.quality}
          onPickRight={setCompareId}
          onSwap={() => {
            const previous = organId;
            setOrganId(compareId);
            setCompareId(previous);
          }}
          onClose={() => setCompareOpen(false)}
        />
      )}

      {mobileLibrary && (
        <button className="drawer-backdrop" aria-label={t.library.close} onClick={() => setMobileLibrary(false)} />
      )}

      <ToastStack toasts={toasts} />
    </>
  );
}
