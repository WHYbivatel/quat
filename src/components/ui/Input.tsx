"use client";

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn";

const fieldClass =
  "w-full rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--control)] px-3 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--focus-ring)] disabled:opacity-50";

type FieldShellProps = {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  children: ReactNode;
  className?: string;
};

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: FieldShellProps) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-sm", className)} htmlFor={htmlFor}>
      <span className="font-medium text-[var(--text-primary)]">
        {label}
        {optional ? (
          <span className="ml-1 font-normal text-[var(--text-secondary)]">(необяз.)</span>
        ) : null}
      </span>
      {children}
      {error ? (
        <span className="text-xs text-[var(--error)]" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs text-[var(--text-secondary)]">{hint}</span>
      ) : null}
    </label>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export function Input({ className, invalid, ...rest }: InputProps) {
  return (
    <input
      className={cn(
        fieldClass,
        "h-11",
        invalid && "border-[var(--error)]",
        className,
      )}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

type SearchProps = InputProps & { label?: string };

export function SearchInput({ label = "Поиск", className, ...rest }: SearchProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" aria-hidden>
        ⌕
      </span>
      <Input
        type="search"
        aria-label={label}
        className={cn("pl-9", className)}
        placeholder={rest.placeholder ?? "Найти товар или услугу…"}
        {...rest}
      />
    </div>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export function Textarea({ className, invalid, ...rest }: TextareaProps) {
  return (
    <textarea
      className={cn(
        fieldClass,
        "min-h-[88px] py-2.5",
        invalid && "border-[var(--error)]",
        className,
      )}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export function Select({ className, invalid, children, ...rest }: SelectProps) {
  return (
    <select
      className={cn(
        fieldClass,
        "h-11 appearance-none bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-9",
        invalid && "border-[var(--error)]",
        className,
      )}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23596052' d='M1 1l5 5 5-5'/%3E%3C/svg%3E")`,
      }}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  );
}
