import type { ReactNode } from "react";
import { cn } from "./cn";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded-[var(--radius-panel)] border border-dashed border-[var(--border)] bg-transparent px-4 py-6",
        className,
      )}
      role="status"
    >
      <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      {description ? (
        <p className="text-sm text-[var(--text-secondary)]">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

export function InlineFeedback({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "error";
  children: ReactNode;
  className?: string;
}) {
  const map = {
    info: "text-[#1a3f7a] bg-[#eaf2ff] border-[#6ea8fe]",
    success: "text-[var(--brand-foreground)] bg-[#eefad0] border-[#c7e86a]",
    warning: "text-[#6b4e00] bg-[#fff6e0] border-[#ffc857]",
    error: "text-[#8f1f1a] bg-[#fff1f0] border-[#ff5c57]",
  } as const;
  return (
    <p
      className={cn(
        "rounded-[var(--radius-input)] border px-3 py-2 text-sm",
        map[tone],
        className,
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}
