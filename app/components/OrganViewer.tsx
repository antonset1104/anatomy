"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react";
import {
  Aperture,
  Box,
  Camera,
  CircleDashed,
  Crosshair,
  FlipHorizontal,
  Layers3,
  Maximize,
  Minimize,
  Radar,
  RotateCcw,
  Ruler,
  ScanLine,
  Sparkles,
  Tag,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Hotspot, Organ } from "../i18n/merge";
import type { OrganId } from "../lib/anatomy-data";
import { format, type UiDictionary } from "../i18n/types";
import type { AnatomyViewer, Quality, SectionAxis, ViewerTheme } from "../lib/three/viewer";
import { viewNames, type ViewName } from "../lib/url-state";

/** What the shell can ask the canvas to do. */
export type ViewerHandle = {
  selectHotspot: (id: string | null, focus?: boolean) => void;
  setView: (view: ViewName) => void;
  capture: () => string | null;
  flash: (id: string, correct: boolean) => void;
  screenY: (id: string) => number | null;
  reset: () => void;
};

type Props = {
  organ: Organ;
  t: UiDictionary;
  handleRef?: Ref<ViewerHandle>;
  autoRotate: boolean;
  onAutoRotate: (enabled: boolean) => void;
  compare: boolean;
  onCompare: () => void;
  quizActive: boolean;
  theme: ViewerTheme;
  quality: Quality;
  alwaysLabels: boolean;
  /** Quiz label mode routes every dot press here instead of selecting. */
  onPick?: (hotspot: Hotspot) => void;
  onSelect?: (hotspot: Hotspot | null) => void;
  onToast?: (text: string) => void;
  /**
   * Fires once the specimen currently on screen has actually finished loading
   * — the real completion signal, not a guess at how long a GLB fetch usually
   * takes. Callers that want to focus a structure right after switching
   * specimens should key off this instead of a fixed delay: on a slow
   * connection or a cold local dev server, a hotspot only a few hundred
   * milliseconds too early lands on a model that has not attached its
   * hotspots yet and silently does nothing.
   */
  onOrganReady?: (organId: OrganId) => void;
  /** True while a lesson or quiz owns the bottom of the stage, so the ambient
   *  chrome gets out of the way. `children` cannot be tested for this — it is
   *  always a fragment, even when both overlays are closed. */
  overlayActive?: boolean;
  children?: React.ReactNode;
};

/** `?authoring=1` is read from the URL without a hydration mismatch. */
function useAuthoringFlag() {
  return useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("authoring") === "1",
    () => false,
  );
}

export function OrganViewer({
  organ,
  t,
  handleRef,
  autoRotate,
  onAutoRotate,
  compare,
  onCompare,
  quizActive,
  theme,
  quality,
  alwaysLabels,
  onPick,
  onSelect,
  onToast,
  onOrganReady,
  overlayActive = false,
  children,
}: Props) {
  const shellRef = useRef<HTMLElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<AnatomyViewer | null>(null);
  const organRef = useRef(organ);
  const autoRotateRef = useRef(autoRotate);
  const canvasLabelRef = useRef(t.viewer.canvas);
  const themeRef = useRef(theme);
  const qualityRef = useRef(quality);
  const labelsRef = useRef(alwaysLabels);
  const [selected, setSelected] = useState<Hotspot | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [slowLoad, setSlowLoad] = useState(false);
  const [failed, setFailed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Tool state that has a UI affordance of its own.
  const [isolated, setIsolated] = useState(false);
  const [xray, setXray] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [sectionAxis, setSectionAxis] = useState<SectionAxis>("x");
  const [sectionDepth, setSectionDepth] = useState(0);
  const [measuring, setMeasuring] = useState(false);
  const [measured, setMeasured] = useState<number | null>(null);
  // Stored with the organ it belongs to, so loading a new specimen falls back
  // to `anterior` by derivation rather than by a resetting effect.
  const [viewState, setViewState] = useState<{ organId: string; view: ViewName }>({
    organId: organ.id,
    view: "anterior",
  });
  const activeView = viewState.organId === organ.id ? viewState.view : "anterior";
  const setActiveView = useCallback(
    (view: ViewName) => setViewState({ organId: organRef.current.id, view }),
    [],
  );

  // Opt-in coordinate probe for placing hotspots — not a user-facing feature.
  const authoring = useAuthoringFlag();
  const authoringRef = useRef(authoring);
  const [authorPoint, setAuthorPoint] = useState<{ x: number; y: number; z: number } | null>(null);
  const [copied, setCopied] = useState(false);

  // The viewer captures its callbacks once, so live handlers go through refs.
  const pickRef = useRef<(hotspot: Hotspot) => void>(() => {});
  const selectRef = useRef<(hotspot: Hotspot | null) => void>(() => {});
  const authorRef = useRef<(point: { x: number; y: number; z: number }) => void>(() => {});
  const readyRef = useRef<(organId: OrganId) => void>(() => {});
  useEffect(() => {
    pickRef.current = (hotspot) => onPick?.(hotspot);
    selectRef.current = (hotspot) => {
      setSelected(hotspot);
      onSelect?.(hotspot);
    };
    authorRef.current = setAuthorPoint;
    readyRef.current = (readyOrganId) => onOrganReady?.(readyOrganId);
  });
  useEffect(() => {
    authoringRef.current = authoring;
  }, [authoring]);

  // A typical organ is ready well inside a second — flashing a loading panel for
  // that reads as jank. It only appears if the fetch is genuinely slow; the flag
  // is cleared by onLoading when the next load starts.
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setSlowLoad(true), 900);
    return () => window.clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    organRef.current = organ;
  }, [organ]);
  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);
  useEffect(() => {
    themeRef.current = theme;
    viewerRef.current?.setTheme(theme);
  }, [theme]);
  useEffect(() => {
    qualityRef.current = quality;
    viewerRef.current?.setQuality(quality);
  }, [quality]);
  useEffect(() => {
    labelsRef.current = alwaysLabels;
    viewerRef.current?.setLabelsVisible(alwaysLabels);
  }, [alwaysLabels]);
  useEffect(() => {
    canvasLabelRef.current = t.viewer.canvas;
    viewerRef.current?.setCanvasLabel(t.viewer.canvas);
  }, [t.viewer.canvas]);

  useEffect(() => {
    let cancelled = false;
    let viewer: AnatomyViewer | null = null;

    void import("../lib/three/viewer")
      .then(({ AnatomyViewer: Viewer, hasWebGL }) => {
        if (cancelled || !mountRef.current) return;
        if (!hasWebGL()) {
          setFailed(true);
          setLoading(false);
          return;
        }
        viewer = new Viewer(mountRef.current, {
          onSelect: (hotspot) => selectRef.current(hotspot),
          onLoading: (isLoading, value) => {
            setLoading(isLoading);
            setProgress(value);
            if (isLoading) setSlowLoad(false);
            // `organRef` is kept current by its own effect, which — because
            // effects run in declaration order within a commit — has already
            // updated by the time the `[organ]` effect below kicks off the load
            // this completion belongs to. Reading it here is what lets a caller
            // wait for "this specific organ is ready" instead of guessing.
            else if (value >= 1) readyRef.current(organRef.current.id);
          },
          onPick: (hotspot) => pickRef.current(hotspot),
          onAuthorPoint: (point) => authorRef.current(point),
          onMeasure: setMeasured,
          onError: () => setFailed(true),
        });
        viewerRef.current = viewer;
        viewer.setCanvasLabel(canvasLabelRef.current);
        viewer.setAutoRotate(autoRotateRef.current);
        viewer.setAuthoring(authoringRef.current);
        viewer.setTheme(themeRef.current);
        viewer.setQuality(qualityRef.current);
        viewer.setLabelsVisible(labelsRef.current);
        const current = organRef.current;
        viewer.setOrgan(current.model, current.hotspots, current.accent, current.realSizeMm).catch(() => {
          setLoading(false);
          setProgress(0);
        });
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
      viewerRef.current = null;
      viewer?.dispose();
    };
  }, []);

  useEffect(() => {
    viewerRef.current?.setOrgan(organ.model, organ.hotspots, organ.accent, organ.realSizeMm).catch(() => {
      setLoading(false);
      setProgress(0);
    });
    // Any live measurement belongs to the specimen being replaced; the viewer's
    // own `clearMeasurement` reports that back through `onMeasure`.
  }, [organ]);

  // A spinning specimen makes "click the mitral valve" a game of chance, so the
  // quiz holds the model still and restores the user's setting on exit.
  useEffect(() => viewerRef.current?.setAutoRotate(autoRotate && !quizActive), [autoRotate, quizActive]);
  useEffect(() => viewerRef.current?.setQuizMode(quizActive), [quizActive]);
  useEffect(() => viewerRef.current?.setAuthoring(authoring), [authoring]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useImperativeHandle(
    handleRef,
    () => ({
      selectHotspot: (id, focus) => viewerRef.current?.selectHotspot(id, { focus }),
      setView: (view) => {
        setActiveView(view);
        viewerRef.current?.setView(view);
      },
      capture: () => viewerRef.current?.capture() ?? null,
      flash: (id, correct) => viewerRef.current?.flash(id, correct),
      screenY: (id) => viewerRef.current?.hotspotScreenY(id) ?? null,
      reset: () => viewerRef.current?.reset(),
    }),
    [],
  );

  // The viewer drives the callout's position directly, so a spinning model
  // never costs a React render.
  const calloutRef = useCallback((node: HTMLDivElement | null) => {
    viewerRef.current?.attachCallout(node);
  }, []);

  const download = (dataUrl: string) => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `anatomy-atelier-${organ.id}.png`;
    link.click();
  };

  const handleTool = (tool: string) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    switch (tool) {
      case "rotate":
        onAutoRotate(!autoRotate);
        break;
      case "zoom":
        viewer.zoom(-1);
        break;
      case "zoomOut":
        viewer.zoom(1);
        break;
      case "isolate":
        setIsolated(viewer.toggleIsolate());
        break;
      case "xray":
        setXray(viewer.toggleXray());
        break;
      case "section": {
        const enabled = viewer.toggleCrossSection();
        setSectionOpen(enabled);
        if (enabled) setSectionDepth(0);
        break;
      }
      case "layers":
        setWireframe(viewer.toggleLayers());
        break;
      case "measure": {
        const next = !measuring;
        setMeasuring(next);
        viewer.setMeasuring(next);
        break;
      }
      case "compare":
        onCompare();
        break;
      case "screenshot": {
        const shot = viewer.capture();
        if (shot) {
          download(shot);
          onToast?.(t.viewer.captured);
        }
        break;
      }
      case "fullscreen":
        if (document.fullscreenElement) void document.exitFullscreen();
        else void shellRef.current?.requestFullscreen?.().catch(() => {});
        break;
      case "reset":
        viewer.reset();
        setIsolated(false);
        setXray(false);
        setWireframe(false);
        setSectionOpen(false);
        setMeasuring(false);
        viewer.setMeasuring(false);
        setMeasured(null);
        setActiveView("anterior");
        break;
    }
  };

  const tools = [
    { id: "rotate", label: t.tools.rotate, icon: RotateCcw, active: autoRotate },
    { id: "zoom", label: t.tools.zoom, icon: ZoomIn, active: false },
    { id: "zoomOut", label: t.tools.zoomOut, icon: ZoomOut, active: false },
    { id: "isolate", label: t.tools.isolate, icon: CircleDashed, active: isolated },
    { id: "xray", label: t.tools.xray, icon: Radar, active: xray },
    { id: "section", label: t.tools.section, icon: ScanLine, active: sectionOpen },
    { id: "layers", label: t.tools.layers, icon: Layers3, active: wireframe },
    { id: "measure", label: t.tools.measure, icon: Ruler, active: measuring },
    { id: "compare", label: t.tools.compare, icon: Box, active: compare },
    { id: "screenshot", label: t.tools.screenshot, icon: Camera, active: false },
    { id: "fullscreen", label: fullscreen ? t.tools.exitFullscreen : t.tools.fullscreen, icon: fullscreen ? Minimize : Maximize, active: fullscreen },
    { id: "reset", label: t.tools.reset, icon: Aperture, active: false },
  ];

  return (
    <section
      ref={shellRef}
      className="viewer-shell"
      aria-label={format(t.viewer.title, { organ: organ.name })}
      data-fullscreen={fullscreen}
    >
      <div className="viewer-glow" style={{ "--organ-accent": organ.accent } as React.CSSProperties} />
      <div ref={mountRef} className="three-mount" />

      {failed ? (
        <div className="viewer-fallback" role="alert">
          <span className="fallback-glyph" style={{ "--art-accent": organ.accent } as React.CSSProperties}>{organ.icon}</span>
          <strong>{t.viewer.webglTitle}</strong>
          <p>{t.viewer.webglBody}</p>
          <button type="button" className="button-primary" onClick={() => window.location.reload()}>{t.viewer.retry}</button>
        </div>
      ) : (
        <>
          <div className="viewer-tools" aria-label={t.tools.label}>
            {tools.map(({ id, label, icon: Icon, active }) => (
              <button
                key={id}
                type="button"
                className={`tool-button ${active ? "active" : ""}`}
                onClick={() => handleTool(id)}
                aria-pressed={active}
                title={label}
              >
                <Icon size={18} strokeWidth={1.65} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="view-presets" role="group" aria-label={t.views.label}>
            {viewNames.map((view) => (
              <button
                key={view}
                type="button"
                className={activeView === view ? "active" : ""}
                aria-pressed={activeView === view}
                onClick={() => {
                  setActiveView(view);
                  viewerRef.current?.setView(view);
                }}
              >
                {t.views[view]}
              </button>
            ))}
          </div>

          {sectionOpen && (
            <div className="section-panel" aria-label={t.section.title}>
              <span className="panel-label">{t.section.title}</span>
              <div className="section-axes" role="group" aria-label={t.section.axis}>
                {(["x", "y", "z"] as SectionAxis[]).map((axis) => (
                  <button
                    key={axis}
                    type="button"
                    className={sectionAxis === axis ? "active" : ""}
                    aria-pressed={sectionAxis === axis}
                    onClick={() => {
                      setSectionAxis(axis);
                      viewerRef.current?.setSectionAxis(axis);
                    }}
                  >
                    {t.section[axis]}
                  </button>
                ))}
              </div>
              <label className="section-slider">
                <span>{t.section.depth}</span>
                <input
                  type="range"
                  min={-1.9}
                  max={1.9}
                  step={0.02}
                  value={sectionDepth}
                  onChange={(event) => {
                    const depth = Number(event.target.value);
                    setSectionDepth(depth);
                    viewerRef.current?.setSectionDepth(depth);
                  }}
                />
              </label>
              <button type="button" className="ghost-button" onClick={() => viewerRef.current?.flipSection()}>
                <FlipHorizontal size={14} /> {t.section.flip}
              </button>
            </div>
          )}

          {measuring && (
            <div className="measure-note" role="status" aria-live="polite">
              <Ruler size={14} />
              <span>{measured === null ? t.viewer.measureHint : format(t.viewer.measureResult, { value: measured.toFixed(1) })}</span>
              {measured !== null && (
                <button type="button" onClick={() => viewerRef.current?.clearMeasurement()}>{t.viewer.measureClear}</button>
              )}
            </div>
          )}

          {!quizActive && !overlayActive && (
            <aside className="tip-note" aria-label={t.viewer.tip}>
              <span><Sparkles size={15} /> {t.viewer.tip}</span>
              <p>{t.viewer.tipDrag}<br />{t.viewer.tipScroll}<br />{t.viewer.tipClick}</p>
            </aside>
          )}

          {selected && !quizActive && (
            <div className="hotspot-callout" ref={calloutRef} data-side="right">
              <div className="callout-body" style={{ "--hotspot-color": selected.color } as React.CSSProperties}>
                <button
                  className="callout-close"
                  type="button"
                  onClick={() => viewerRef.current?.clearSelection()}
                  aria-label={t.common.close}
                >
                  <X size={13} />
                </button>
                <b>{selected.label}</b>
                <small>{selected.detail}</small>
                <i className="callout-latin">{selected.ta}</i>
              </div>
            </div>
          )}

          {loading && slowLoad && (
            <div className="model-loader" role="status" aria-live="polite">
              <div className="loader-orbit"><Crosshair size={20} /></div>
              <strong>{format(t.viewer.loading, { organ: organ.name })}</strong>
              <span>{Math.max(8, Math.round(progress * 100))}%</span>
            </div>
          )}

          {!quizActive && !overlayActive && (
            <div className="viewer-footer">
              <button className="auto-rotate" type="button" onClick={() => onAutoRotate(!autoRotate)} aria-pressed={autoRotate}>
                <RotateCcw size={13} /> {t.viewer.autoRotate}
                <span className={`switch ${autoRotate ? "on" : ""}`}><i /></span>
              </button>
              <span className="labels-hint">
                <Tag size={12} /> {alwaysLabels ? t.settings.labelsAlways : t.viewer.keyboardHint}
              </span>
            </div>
          )}

          {authoring && (
            <div className="authoring-panel">
              <span><Crosshair size={13} /> authoring</span>
              {authorPoint ? (
                <>
                  <code>{`{ id: "", ta: "", position: [${authorPoint.x}, ${authorPoint.y}, ${authorPoint.z}], color: "#ee7c6a", layer: "surface" },`}</code>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(`{ id: "", ta: "", position: [${authorPoint.x}, ${authorPoint.y}, ${authorPoint.z}], color: "#ee7c6a", layer: "surface" },`)
                        .then(() => {
                          setCopied(true);
                          window.setTimeout(() => setCopied(false), 1200);
                        });
                    }}
                  >
                    {copied ? "copied" : "copy"}
                  </button>
                </>
              ) : (
                <code>click the model to sample a point</code>
              )}
            </div>
          )}
        </>
      )}

      {/* Screen-reader equivalent of the dots, which live in the canvas. */}
      <ul className="sr-only" aria-label={t.viewer.structures}>
        {organ.hotspots.map((hotspot) => (
          <li key={hotspot.id}>{hotspot.label}: {hotspot.detail}</li>
        ))}
      </ul>

      <div className="view-caption">
        <span>{t.viewer.caption}</span>
        <strong>{organ.scientificName}</strong>
      </div>

      {children}
    </section>
  );
}
