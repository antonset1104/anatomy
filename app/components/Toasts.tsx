"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Info, Trophy } from "lucide-react";

export type Toast = { id: number; text: string; tone: "info" | "success" | "award" };

const ICONS = { info: Info, success: Check, award: Trophy };
const LIFETIME_MS = 3200;

/**
 * A tiny queue rather than a context provider: toasts are fired from event
 * handlers all over the tree, and threading a provider through every one of them
 * buys nothing over a callback the shell owns.
 */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);

  const push = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-2), { id, text, tone }]);
    timers.current.push(
      window.setTimeout(() => setToasts((list) => list.filter((toast) => toast.id !== id)), LIFETIME_MS),
    );
  }, []);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  return { toasts, push };
}

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.tone];
        return (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            <Icon size={15} />
            <span>{toast.text}</span>
          </div>
        );
      })}
    </div>
  );
}
