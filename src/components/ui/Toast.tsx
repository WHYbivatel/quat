"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "./cn";

type ToastTone = "success" | "error" | "warning" | "info" | "neutral";

export type ToastInput = {
  id?: string;
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number | null;
  action?: { label: string; href?: string; onClick?: () => void };
};

type ToastItem = Required<Pick<ToastInput, "id" | "title" | "tone">> &
  Omit<ToastInput, "id" | "title" | "tone"> & { createdAt: number };

type Ctx = {
  push: (t: ToastInput) => string;
  dismiss: (id: string) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

const toneAccent: Record<ToastTone, string> = {
  success: "var(--success)",
  error: "var(--error)",
  warning: "var(--warning)",
  info: "var(--info)",
  neutral: "var(--neutral)",
};

const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const queue = useRef<ToastItem[]>([]);

  const flush = useCallback(() => {
    setItems((visible) => {
      if (visible.length >= MAX_VISIBLE || queue.current.length === 0) return visible;
      const next = [...visible];
      while (next.length < MAX_VISIBLE && queue.current.length > 0) {
        next.unshift(queue.current.shift()!);
      }
      return next;
    });
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((t) => t.id !== id));
      queue.current = queue.current.filter((t) => t.id !== id);
      requestAnimationFrame(flush);
    },
    [flush],
  );

  const push = useCallback(
    (input: ToastInput) => {
      const id = input.id ?? crypto.randomUUID();
      const item: ToastItem = {
        id,
        title: input.title,
        description: input.description,
        tone: input.tone ?? "neutral",
        durationMs: input.durationMs === undefined ? 4500 : input.durationMs,
        action: input.action,
        createdAt: Date.now(),
      };
      setItems((prev) => {
        const dup = prev.find((t) => t.title === item.title && t.tone === item.tone);
        if (dup) {
          return prev.map((t) => (t.id === dup.id ? { ...item, id: dup.id } : t));
        }
        if (prev.length < MAX_VISIBLE) return [item, ...prev];
        queue.current.push(item);
        return prev;
      });
      return id;
    },
    [],
  );

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-6 top-6 z-[80] flex w-[min(360px,calc(100vw-24px))] flex-col gap-2.5 max-sm:left-3 max-sm:right-3 max-sm:top-[max(12px,env(safe-area-inset-top))] max-sm:w-auto"
        aria-live="polite"
      >
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} onGone={flush} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast outside ToastProvider");
  return ctx;
}

function ToastCard({
  item,
  onDismiss,
  onGone,
}: {
  item: ToastItem;
  onDismiss: () => void;
  onGone: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const barId = useId();
  const duration = item.durationMs;

  useEffect(() => {
    if (duration == null || duration <= 0) return;
    if (paused) return;
    if (typeof document !== "undefined" && document.hidden) return;
    const t = setTimeout(() => setHidden(true), duration);
    return () => clearTimeout(t);
  }, [duration, paused, item.id]);

  useEffect(() => {
    if (!hidden) return;
    const t = setTimeout(() => {
      onDismiss();
      onGone();
    }, 280);
    return () => clearTimeout(t);
  }, [hidden, onDismiss, onGone]);

  useEffect(() => {
    function onVis() {
      if (document.hidden) setPaused(true);
      else setPaused(false);
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const accent = toneAccent[item.tone];
  const polite = item.tone === "error" ? "assertive" : "polite";

  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      aria-live={polite}
      className={cn(
        "pointer-events-auto relative overflow-hidden rounded-[var(--radius-toast)] border border-white/8 text-[var(--text-inverse)] shadow-[0_10px_30px_rgba(0,0,0,.16),0_2px_8px_rgba(0,0,0,.10)] backdrop-blur-[16px] transition-[transform,opacity] duration-300",
        hidden ? "translate-x-6 opacity-0" : "translate-x-0 opacity-100",
      )}
      style={{ background: "var(--toast)", minHeight: 72 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="flex gap-3 px-4 py-3.5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
          style={{ background: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }}
          aria-hidden
        >
          {item.tone === "success" ? "✓" : item.tone === "error" ? "!" : item.tone === "warning" ? "⚠" : "i"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{item.title}</p>
          {item.description ? (
            <p className="mt-0.5 text-[13px] font-normal text-[var(--text-muted-on-dark)]">
              {item.description}
            </p>
          ) : null}
          {item.action ? (
            item.action.href ? (
              <a
                href={item.action.href}
                className="mt-2 inline-block text-[13px] font-medium underline"
                style={{ color: accent }}
              >
                {item.action.label}
              </a>
            ) : (
              <button
                type="button"
                className="mt-2 text-[13px] font-medium underline"
                style={{ color: accent }}
                onClick={item.action.onClick}
              >
                {item.action.label}
              </button>
            )
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Закрыть уведомление"
          className="h-6 w-6 shrink-0 rounded text-[var(--text-muted-on-dark)] hover:text-[var(--text-inverse)]"
          onClick={() => setHidden(true)}
        >
          ×
        </button>
      </div>
      {duration != null && duration > 0 ? (
        <div
          id={barId}
          className="absolute bottom-0 left-0 h-0.5 w-full origin-left"
          style={{
            background: accent,
            animation: `toast-progress ${duration}ms linear forwards`,
            animationPlayState: paused ? "paused" : "running",
          }}
        />
      ) : null}
    </div>
  );
}
