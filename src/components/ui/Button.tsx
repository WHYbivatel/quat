"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "icon";
export type ButtonSize = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pending?: boolean;
  children: ReactNode;
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-base",
};

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--brand)] text-[var(--brand-foreground)] hover:brightness-95 active:scale-[0.98] disabled:opacity-50",
  secondary:
    "bg-[var(--control)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--surface-subtle)] active:scale-[0.98] disabled:opacity-50",
  ghost:
    "bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] active:scale-[0.98] disabled:opacity-50",
  danger:
    "bg-[var(--control)] text-[var(--error)] border border-[var(--border)] hover:bg-[#fff1f0] active:scale-[0.98] disabled:opacity-50",
  icon:
    "inline-flex h-11 w-11 items-center justify-center bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] active:scale-[0.98] disabled:opacity-50",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "primary",
    size = "md",
    pending = false,
    disabled,
    className,
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] font-semibold transition-[transform,background,filter] duration-[var(--motion-fast)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
        variant !== "icon" && sizeClass[size],
        variantClass[variant],
        className,
      )}
      {...rest}
    >
      {pending ? <span className="text-[var(--text-secondary)]">…</span> : null}
      {children}
    </button>
  );
});
