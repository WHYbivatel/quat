import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** Prefer structural parts (PanelHeader / PanelToolbar / rows) over whole-panel padding */
  padding?: "none" | "sm" | "md";
};

const padClass = {
  none: "",
  sm: "p-3",
  md: "p-4",
} as const;

/** Soft panel on gray page: catalog, estimate, forms */
export function Panel({
  children,
  className,
  padding = "none",
  ...rest
}: PanelProps) {
  return (
    <div
      className={cn(
        "qh-panel rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--panel)]",
        padClass[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Title block — padding 20×24 */
export function PanelHeader({
  children,
  className,
  bordered = true,
}: {
  children: ReactNode;
  className?: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={cn(
        "qh-panel-header shrink-0",
        bordered && "border-b border-[var(--border)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Tool rows inside a Panel — sides 24, bottom 20; top 20 unless flushTop (under PanelHeader) */
export function PanelToolbar({
  children,
  className,
  flushTop = false,
}: {
  children: ReactNode;
  className?: string;
  flushTop?: boolean;
}) {
  return (
    <div
      className={cn(
        "qh-panel-toolbar flex shrink-0 flex-col",
        flushTop && "qh-panel-toolbar--flush",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PanelToolbarRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center justify-between gap-3", className)}>
      {children}
    </div>
  );
}

export function PanelDivider({ className }: { className?: string }) {
  return <div className={cn("shrink-0 border-t border-[var(--border)]", className)} role="separator" />;
}

/** Scrollable middle of a panel */
export function PanelBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("qh-panel-body min-h-0 min-w-0 flex-1 overflow-y-auto", className)}>
      {children}
    </div>
  );
}

/** Estimate shell: header / scroll / footer — grid auto minmax(0,1fr) auto */
export function EstimatePanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Panel
      padding="none"
      className={cn(
        "qh-estimate-panel grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto]",
        className,
      )}
    >
      {children}
    </Panel>
  );
}

export function EstimatePanelBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("qh-estimate-body min-h-0 overflow-y-auto", className)}>
      {children}
    </div>
  );
}

export function EstimatePanelFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("qh-estimate-footer shrink-0", className)}>{children}</div>
  );
}

/**
 * Page workspace under the header.
 * Desktop: 24px pad, 24px gap, grid 62fr / 38fr, height = viewport − header.
 * Mobile: single column; estimate opens via bottom bar.
 */
export function Workspace({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("qh-workspace", className)}>
      {children}
    </div>
  );
}
