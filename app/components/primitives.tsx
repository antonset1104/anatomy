"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import type { Organ } from "../i18n/merge";

/**
 * Renders an organ illustration, or its accent glyph for organs that ship as a
 * 3D model without the painted asset set. Keeps every image slot filled instead
 * of leaving a broken `<img>` behind.
 */
export function OrganArt({
  organ,
  asset,
  alt,
  size,
}: {
  organ: Organ;
  asset: "thumb" | "organ" | "microscopic" | "compare" | "location";
  alt: string;
  size?: number;
}) {
  if (!organ.illustrated) {
    // An empty alt means a surrounding control already names this, so the
    // glyph should be skipped rather than announced with no label.
    const labelling = alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true };
    return (
      <span className="art-fallback" style={{ "--art-accent": organ.accent } as React.CSSProperties} {...labelling}>
        {organ.icon}
      </span>
    );
  }
  return (
    <img
      key={`${organ.id}-${asset}`}
      src={`/anatomy/${organ.id}/${asset}.webp`}
      alt={alt}
      width={size}
      height={size}
      loading={asset === "thumb" ? "eager" : "lazy"}
      decoding="async"
    />
  );
}

/**
 * Measurements like "250–350 g" begin with a digit, which Unicode treats as
 * neutral — inside an RTL paragraph the range gets visually reversed. Digits
 * are not "strong" characters, so `unicode-bidi: plaintext` cannot rescue it;
 * the run has to be isolated as LTR explicitly.
 */
export function Measure({ children }: { children: string }) {
  return <bdi dir={/^[\d(]/.test(children.trim()) ? "ltr" : "auto"}>{children}</bdi>;
}

/**
 * The one dialog in the app. Owns the focus trap, the Escape key, and the
 * scroll lock so no caller has to remember them.
 */
export function Modal({
  title,
  subtitle,
  onClose,
  closeLabel,
  size = "md",
  children,
  footer,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  closeLabel: string;
  size?: "sm" | "md" | "lg" | "xl";
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("[data-autofocus], button, [href], input, select, textarea")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      // Tab must not walk out into the page behind the dialog.
      const focusable = [...panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter((node) => !node.hasAttribute("disabled") && node.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={panelRef}
        className={`sheet sheet-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sheet-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={closeLabel}>
            <X size={17} />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </section>
    </div>
  );
}

/** A radio group that looks like a segmented control. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={value === option.value ? "active" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A metric as a bar with its usual range shaded behind the fill, which is the
 * whole point: "72 bpm" means little until you can see where 72 sits.
 */
export function MetricBar({
  label,
  value,
  max,
  unit,
  band,
  accent,
  rangeLabel,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  band?: [number, number];
  accent: string;
  rangeLabel?: string;
}) {
  const pct = Math.min(100, Math.max(2, (value / max) * 100));
  const bandStart = band ? Math.min(100, (band[0] / max) * 100) : null;
  const bandWidth = band ? Math.min(100 - (bandStart ?? 0), ((band[1] - band[0]) / max) * 100) : null;

  return (
    <div className="metric" style={{ "--metric-accent": accent } as React.CSSProperties}>
      <div className="metric-head">
        <span>{label}</span>
        <strong>
          <bdi dir="ltr">
            {value.toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit}
          </bdi>
        </strong>
      </div>
      <div className="metric-track" role="img" aria-label={`${label}: ${value} ${unit}`}>
        {bandStart !== null && bandWidth !== null && (
          <i className="metric-band" style={{ inlineSize: `${bandWidth}%`, insetInlineStart: `${bandStart}%` }} />
        )}
        <i className="metric-fill" style={{ inlineSize: `${pct}%` }} />
      </div>
      {rangeLabel && <small>{rangeLabel}</small>}
    </div>
  );
}

/** A donut used for mastery percentages. Pure CSS, no chart dependency. */
export function Ring({ percent, label, accent }: { percent: number; label?: string; accent?: string }) {
  return (
    <div
      className="ring"
      style={{ "--ring-value": `${Math.max(0, Math.min(100, percent))}`, "--ring-accent": accent ?? "var(--accent)" } as React.CSSProperties}
      role="img"
      aria-label={label ? `${label}: ${percent}%` : `${percent}%`}
    >
      <span>{percent}%</span>
    </div>
  );
}
