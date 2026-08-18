"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Link, Link2Off } from "lucide-react";
import type { Organ } from "../i18n/merge";
import { format, type UiDictionary } from "../i18n/types";
import type { OrganId } from "../lib/anatomy-data";
import type { AnatomyViewer, Quality, ViewerTheme } from "../lib/three/viewer";
import { viewNames, type ViewName } from "../lib/url-state";
import { Measure, Modal, OrganArt } from "./primitives";

/**
 * A viewer with no chrome. Comparison is about the two specimens sitting next to
 * each other at the same scale, so every tool that would pull attention to one
 * side is deliberately absent.
 */
function MiniViewer({
  organ,
  theme,
  quality,
  view,
  label,
}: {
  organ: Organ;
  theme: ViewerTheme;
  quality: Quality;
  view: ViewName;
  label: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<AnatomyViewer | null>(null);
  const [ready, setReady] = useState(false);
  // Captured at mount only: the effects below push later changes in, and reading
  // a ref during render is exactly the pattern that breaks under concurrency.
  const initialOrgan = useRef(organ);

  useEffect(() => {
    let cancelled = false;
    let viewer: AnatomyViewer | null = null;

    void import("../lib/three/viewer").then(({ AnatomyViewer: Viewer, hasWebGL }) => {
      if (cancelled || !mountRef.current || !hasWebGL()) return;
      viewer = new Viewer(mountRef.current, {
        onSelect: () => {},
        onLoading: (loading) => setReady(!loading),
      });
      viewerRef.current = viewer;
      viewer.setCanvasLabel(label);
      viewer.setTheme(theme);
      viewer.setQuality(quality);
      viewer.setAutoRotate(true);
      const current = initialOrgan.current;
      void viewer.setOrgan(current.model, current.hotspots, current.accent, current.realSizeMm).catch(() => {});
    });

    return () => {
      cancelled = true;
      viewerRef.current = null;
      viewer?.dispose();
    };
    // Mounted once per side; the organ is pushed in through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void viewerRef.current?.setOrgan(organ.model, organ.hotspots, organ.accent, organ.realSizeMm).catch(() => {});
  }, [organ]);
  useEffect(() => viewerRef.current?.setTheme(theme), [theme]);
  useEffect(() => viewerRef.current?.setView(view), [view]);

  return (
    <div className="compare-stage" style={{ "--organ-accent": organ.accent } as React.CSSProperties}>
      <div ref={mountRef} className="three-mount" />
      <div className="compare-stage-caption">
        <strong>{organ.name}</strong>
        <small>{organ.scientificName}</small>
      </div>
      {!ready && <span className="compare-loading" aria-hidden />}
    </div>
  );
}

export function CompareView({
  t,
  organs,
  left,
  right,
  theme,
  quality,
  onPickRight,
  onSwap,
  onClose,
}: {
  t: UiDictionary;
  organs: Organ[];
  left: Organ;
  right: Organ;
  theme: ViewerTheme;
  quality: Quality;
  onPickRight: (id: OrganId) => void;
  onSwap: () => void;
  onClose: () => void;
}) {
  const [linked, setLinked] = useState(true);
  const [view, setView] = useState<ViewName>("anterior");
  const [rightView, setRightView] = useState<ViewName>("anterior");

  const rows: { label: string; a: string; b: string }[] = [
    { label: t.info.system, a: left.system, b: right.system },
    { label: t.compare.primaryRole, a: left.function, b: right.function },
    { label: t.info.size, a: left.size, b: right.size },
    { label: t.info.weight, a: left.weight, b: right.weight },
    { label: t.info.location, a: left.location, b: right.location },
    { label: t.info.bloodSupply, a: left.bloodSupply, b: right.bloodSupply },
    {
      label: t.structures.title,
      a: format(t.structures.count, { count: left.hotspots.length }),
      b: format(t.structures.count, { count: right.hotspots.length }),
    },
  ];

  return (
    <Modal title={t.compare.title} subtitle={`${left.name} ${t.compare.vs} ${right.name}`} closeLabel={t.compare.close} onClose={onClose} size="xl">
      <div className="compare-toolbar">
        <div className="view-presets inline" role="group" aria-label={t.views.label}>
          {viewNames.map((name) => (
            <button
              key={name}
              type="button"
              className={view === name ? "active" : ""}
              aria-pressed={view === name}
              onClick={() => {
                setView(name);
                if (linked) setRightView(name);
              }}
            >
              {t.views[name]}
            </button>
          ))}
        </div>
        <button type="button" className={`chip-button ${linked ? "active" : ""}`} aria-pressed={linked} onClick={() => setLinked((value) => !value)}>
          {linked ? <Link size={14} /> : <Link2Off size={14} />} {t.compare.sync}
        </button>
        <button type="button" className="chip-button" onClick={onSwap}>
          <ArrowLeftRight size={14} /> {t.compare.swap}
        </button>
        <label className="compare-picker">
          <span className="sr-only">{t.compare.pick}</span>
          <select value={right.id} onChange={(event) => onPickRight(event.target.value as OrganId)}>
            {organs
              .filter((organ) => organ.id !== left.id)
              .map((organ) => (
                <option key={organ.id} value={organ.id}>{organ.name}</option>
              ))}
          </select>
        </label>
      </div>

      <div className="compare-stages">
        <MiniViewer organ={left} theme={theme} quality={quality} view={view} label={left.name} />
        <MiniViewer organ={right} theme={theme} quality={quality} view={linked ? view : rightView} label={right.name} />
      </div>

      <table className="compare-table">
        <thead>
          <tr>
            <th scope="col">{t.compare.metric}</th>
            <th scope="col">
              <span className="compare-head">
                <span className="organ-glyph" style={{ "--item-accent": left.accent } as React.CSSProperties}>
                  <OrganArt organ={left} asset="thumb" alt="" size={26} />
                </span>
                {left.name}
              </span>
            </th>
            <th scope="col">
              <span className="compare-head">
                <span className="organ-glyph" style={{ "--item-accent": right.accent } as React.CSSProperties}>
                  <OrganArt organ={right} asset="thumb" alt="" size={26} />
                </span>
                {right.name}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td><Measure>{row.a}</Measure></td>
              <td><Measure>{row.b}</Measure></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
