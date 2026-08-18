"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A display-ad placeholder that costs nothing until it is configured and nothing
 * until it is nearly on screen.
 *
 * Three rules this component exists to enforce:
 *
 *  1. **No publisher id, no markup.** With `NEXT_PUBLIC_ADSENSE_CLIENT` unset the
 *     component renders `null` — not an empty reserved box — so an unmonetised
 *     deployment has no holes in its layout and ships no ad code at all.
 *  2. **No layout shift.** When it *is* configured the container reserves its
 *     height up front. An ad that pushes the article down after paint is a direct
 *     hit to CLS, which is both a ranking signal and the fastest way to make a
 *     reader lose their place.
 *  3. **No script until needed.** The network's library is injected once, lazily,
 *     when the first slot comes within a screen of the viewport. Loading it in
 *     `<head>` would put a third-party script in front of the page's own LCP.
 */
export type AdFormat = "leaderboard" | "inline" | "square";

/** Reserved heights, matched to the CSS so the box never resizes on fill. */
const RESERVED: Record<AdFormat, number> = { leaderboard: 100, inline: 280, square: 260 };

const SCRIPT_ID = "adsbygoogle-js";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

function ensureScript(client: string) {
  if (document.getElementById(SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(script);
}

export function AdSlot({
  client,
  slot,
  format = "inline",
  label,
}: {
  /** Passed down from the server so the env var stays a build-time constant. */
  client?: string;
  slot?: string;
  format?: AdFormat;
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const filled = useRef(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || !client || !slot) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [client, slot]);

  useEffect(() => {
    if (!visible || !client || !slot || filled.current) return;
    filled.current = true;
    ensureScript(client);
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {
      // A blocked or failed network is not an error worth surfacing — the
      // reserved box simply stays empty.
    }
  }, [visible, client, slot]);

  if (!client || !slot) return null;

  return (
    <aside
      className={`ad-slot ad-${format}`}
      style={{ "--ad-height": `${RESERVED[format]}px` } as React.CSSProperties}
      aria-label={label}
    >
      <span className="ad-label">{label}</span>
      <div ref={containerRef} className="ad-frame">
        {visible && (
          <ins
            className="adsbygoogle"
            style={{ display: "block", width: "100%", height: `${RESERVED[format]}px` }}
            data-ad-client={client}
            data-ad-slot={slot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        )}
      </div>
    </aside>
  );
}
