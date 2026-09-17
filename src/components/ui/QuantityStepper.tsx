"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "./cn";
import { Button } from "./Button";

type Props = {
  value: number | string;
  onChange: (next: number) => void;
  /** When set, minus at min calls this instead of staying disabled (e.g. remove line) */
  onRemoveAtMin?: () => void;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  pending?: boolean;
  error?: boolean;
  label?: string;
  className?: string;
  holdEnabled?: boolean;
  presets?: number[];
};

function toNumber(v: number | string) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function roundToStep(n: number, step: number) {
  const precision = String(step).includes(".")
    ? String(step).split(".")[1]?.length ?? 0
    : 0;
  const f = 10 ** precision;
  return Math.round(n * f) / f;
}

/** Shared catalog + estimate stepper — fixed 44×44 controls, stable value width */
export function QuantityStepper({
  value,
  onChange,
  onRemoveAtMin,
  step = 1,
  min = step,
  max,
  disabled,
  pending,
  error,
  label = "Количество",
  className,
  holdEnabled = true,
  presets,
}: Props) {
  const current = toNumber(value);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(current));

  function clearHold() {
    if (delay.current) clearTimeout(delay.current);
    if (timer.current) clearInterval(timer.current);
    delay.current = null;
    timer.current = null;
  }

  useEffect(() => () => clearHold(), []);

  useEffect(() => {
    if (!editing) setDraft(String(current));
  }, [current, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function applyDelta(dir: 1 | -1) {
    if (disabled || pending || editing) return;
    if (dir < 0 && current <= min && onRemoveAtMin) {
      onRemoveAtMin();
      return;
    }
    let next = roundToStep(current + dir * step, step);
    if (next < min) next = min;
    if (max != null && next > max) next = max;
    if (next === current) return;
    onChange(next);
  }

  function startHold(dir: 1 | -1) {
    if (!holdEnabled || editing) return;
    applyDelta(dir);
    // Don't auto-repeat remove-at-min
    if (dir < 0 && current <= min && onRemoveAtMin) return;
    delay.current = setTimeout(() => {
      timer.current = setInterval(() => applyDelta(dir), 80);
    }, 400);
  }

  function commitEdit() {
    const raw = draft.replace(",", ".").trim();
    let next = Number(raw);
    if (!Number.isFinite(next)) {
      setDraft(String(current));
      setEditing(false);
      return;
    }
    next = roundToStep(next, step);
    if (next < min) {
      if (onRemoveAtMin && next < min) {
        onRemoveAtMin();
        setEditing(false);
        return;
      }
      next = min;
    }
    if (max != null && next > max) next = max;
    onChange(next);
    setEditing(false);
  }

  const atMin = current <= min;
  const minusDisabled =
    disabled || pending || editing || (atMin && !onRemoveAtMin);

  const btn =
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-button)] border border-[var(--border)] bg-[var(--control)] text-base font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] active:scale-[0.98] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";

  return (
    <div className={cn("inline-flex flex-col items-start gap-1.5", className)}>
      <div
        className={cn(
          "inline-flex items-center gap-1.5",
          error && "rounded-[var(--radius-button)] ring-2 ring-[var(--error)]",
        )}
        role="group"
        aria-label={label}
      >
        <button
          type="button"
          className={btn}
          aria-label={`Уменьшить ${label}`}
          disabled={minusDisabled}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            startHold(-1);
          }}
          onPointerUp={clearHold}
          onPointerLeave={clearHold}
          onPointerCancel={clearHold}
          onClick={() => {
            if (!holdEnabled) applyDelta(-1);
          }}
        >
          −
        </button>
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            aria-label={`Ввести ${label}`}
            className="box-border h-11 w-12 shrink-0 rounded-[var(--radius-button)] border border-[var(--border)] bg-[var(--control)] px-1 text-center text-sm font-semibold tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
            value={draft}
            disabled={disabled || pending}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitEdit();
              }
              if (e.key === "Escape") {
                setDraft(String(current));
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="box-border inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-[var(--radius-button)] px-1 text-center text-sm font-semibold tabular-nums hover:bg-[var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] disabled:opacity-40"
            aria-live="polite"
            aria-label={`${label}: ${current}. Двойной щелчок — ввести вручную`}
            disabled={disabled || pending}
            onDoubleClick={() => {
              if (disabled || pending) return;
              setDraft(String(current));
              setEditing(true);
            }}
          >
            {pending ? "…" : current}
          </button>
        )}
        <button
          type="button"
          className={btn}
          aria-label={`Увеличить ${label}`}
          disabled={disabled || pending || editing || (max != null && current >= max)}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            startHold(1);
          }}
          onPointerUp={clearHold}
          onPointerLeave={clearHold}
          onPointerCancel={clearHold}
          onClick={() => {
            if (!holdEnabled) applyDelta(1);
          }}
        >
          +
        </button>
      </div>
      {presets && presets.length > 0 && !editing ? (
        <div className="flex flex-wrap gap-1">
          {presets.map((p) => (
            <Button
              key={p}
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-8 px-2 text-xs font-medium text-[var(--text-secondary)]"
              disabled={disabled || pending}
              onClick={() => onChange(roundToStep(current + p, step))}
            >
              +{p}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
