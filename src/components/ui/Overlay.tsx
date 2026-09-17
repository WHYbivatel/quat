"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";
import { Button } from "./Button";
import { useIsDesktopViewport } from "@/components/useViewportMode";

type MenuClose = () => void;
const MenuCloseCtx = createContext<MenuClose | null>(null);

type Coords = { top: number; left: number; width: number };

const GAP = 8;
const MENU_MIN = 260;
const MENU_MAX = 300;
const VIEW_PAD = 8;

function computeCoords(
  trigger: DOMRect,
  menuH: number,
  prefer: "top" | "bottom" | "auto",
  alignEnd: boolean,
): Coords {
  const width = Math.min(MENU_MAX, Math.max(MENU_MIN, Math.round(trigger.width)));
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let side: "top" | "bottom" = prefer === "bottom" ? "bottom" : "top";
  if (prefer !== "bottom") {
    const spaceAbove = trigger.top - VIEW_PAD;
    const spaceBelow = vh - trigger.bottom - VIEW_PAD;
    if (prefer === "top") {
      side = spaceAbove >= menuH + GAP || spaceAbove >= spaceBelow ? "top" : "bottom";
    } else {
      side = spaceBelow < menuH + GAP && spaceAbove > spaceBelow ? "top" : "bottom";
    }
  }

  let top = side === "top" ? trigger.top - GAP - menuH : trigger.bottom + GAP;
  top = Math.max(VIEW_PAD, Math.min(top, vh - menuH - VIEW_PAD));

  let left = alignEnd ? trigger.right - width : trigger.left;
  left = Math.max(VIEW_PAD, Math.min(left, vw - width - VIEW_PAD));

  return { top, left, width };
}

export function Menu({
  label,
  children,
  align = "start",
  placement = "top",
  className,
  variant = "secondary",
  size = "sm",
}: {
  label: ReactNode;
  children: ReactNode;
  align?: "left" | "right" | "start" | "end";
  placement?: "top" | "bottom" | "auto";
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const isDesktop = useIsDesktopViewport();
  const alignEnd = align === "right" || align === "end";
  const prefer = placement === "bottom" ? "bottom" : placement === "auto" ? "auto" : "top";

  const close = useCallback(() => {
    setOpen(false);
    setCoords(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const tr = trigger.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight || 148;
    setCoords(computeCoords(tr, menuH, prefer, alignEnd));
  }, [alignEnd, prefer]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !isDesktop) return;
    updatePosition();
    // Second pass after menu paints with real height
    const id = requestAnimationFrame(() => {
      updatePosition();
      const first = menuRef.current?.querySelector<HTMLElement>(
        '[role="menuitem"]:not([disabled])',
      );
      first?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open, isDesktop, updatePosition]);

  useEffect(() => {
    if (!open || !isDesktop) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, isDesktop, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const trigger = (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      aria-expanded={open}
      aria-haspopup="menu"
      aria-controls={open ? menuId : undefined}
      onClick={() => setOpen((v) => !v)}
      ref={triggerRef}
    >
      {label}
    </Button>
  );

  if (!isDesktop) {
    return (
      <div className={cn(className?.includes("w-full") && "w-full")}>
        {trigger}
        {open && portalReady
          ? createPortal(
              <div className="fixed inset-0 z-[80]" role="presentation">
                <button
                  type="button"
                  className="absolute inset-0 bg-black/40"
                  aria-label="Закрыть"
                  onClick={close}
                />
                <div
                  role="menu"
                  id={menuId}
                  ref={menuRef}
                  className="absolute inset-x-0 bottom-0 rounded-t-[var(--radius-panel)] border border-[var(--border)] bg-[var(--control)] p-2 pb-[max(12px,env(safe-area-inset-bottom))] shadow-xl"
                >
                  <p className="px-3 py-2 text-sm font-semibold">Скачать смету</p>
                  <MenuCloseCtx.Provider value={close}>{children}</MenuCloseCtx.Provider>
                </div>
              </div>,
              document.body,
            )
          : null}
      </div>
    );
  }

  return (
    <div className={cn(className?.includes("w-full") ? "w-full" : "inline-block")}>
      {trigger}
      {open && portalReady
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              id={menuId}
              className="fixed z-[80] rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--control)] p-1 shadow-lg"
              style={
                coords
                  ? {
                      top: coords.top,
                      left: coords.left,
                      width: coords.width,
                      minWidth: MENU_MIN,
                    }
                  : { top: 0, left: 0, visibility: "hidden" as const }
              }
            >
              <MenuCloseCtx.Provider value={close}>{children}</MenuCloseCtx.Provider>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const close = useContext(MenuCloseCtx);

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      className={cn(
        "flex w-full items-center rounded-[8px] px-3 py-2.5 text-left text-sm hover:bg-[var(--surface-subtle)] focus-visible:bg-[var(--surface-subtle)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
        danger ? "text-[var(--error)]" : "text-[var(--text-primary)]",
      )}
      onClick={(e) => {
        if (disabled) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClick?.();
        close?.();
      }}
    >
      {children}
    </button>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Закрыть" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 max-h-[90vh] w-full max-w-md overflow-auto rounded-t-[var(--radius-panel)] bg-[var(--panel)] p-5 shadow-xl sm:rounded-[var(--radius-panel)]"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" className="text-[var(--text-secondary)]" aria-label="Закрыть" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70]" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Закрыть" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-[var(--radius-panel)] bg-[var(--panel)] shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" className="text-[var(--text-secondary)]" aria-label="Закрыть" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
}
