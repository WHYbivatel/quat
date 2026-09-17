import type { ReactNode } from "react";
import { cn } from "./cn";

type BadgeTone = "neutral" | "success" | "warning" | "error" | "info" | "brand";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-[var(--surface-subtle)] text-[var(--text-secondary)] border-[var(--border)]",
  success: "bg-[#eefad0] text-[var(--brand-foreground)] border-[#c7e86a]",
  warning: "bg-[#fff6e0] text-[#6b4e00] border-[#ffc857]",
  error: "bg-[#fff1f0] text-[#8f1f1a] border-[#ff5c57]",
  info: "bg-[#eaf2ff] text-[#1a3f7a] border-[#6ea8fe]",
  brand: "bg-[var(--brand)] text-[var(--brand-foreground)] border-transparent",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function FilterChip({
  children,
  active,
  onRemove,
  className,
}: {
  children: ReactNode;
  active?: boolean;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs",
        active
          ? "border-[var(--focus-ring)] bg-[var(--surface)] text-[var(--text-primary)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]",
        className,
      )}
    >
      {children}
      {onRemove ? (
        <button
          type="button"
          aria-label="Сбросить фильтр"
          className="ml-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          onClick={onRemove}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}
