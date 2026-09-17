"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/actions/session";

type MenuLink = { href: string; label: string };

export function AccountMenu({
  email,
  orgName,
  links,
}: {
  email: string;
  orgName: string | null;
  links: MenuLink[];
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        className="inline-flex min-h-10 items-center gap-1 rounded-[var(--radius-button)] border border-[var(--border)] bg-[var(--control)] px-3 text-sm font-medium hover:bg-[var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        Аккаунт
        <span aria-hidden>▾</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-64 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--control)] p-1 shadow-lg"
        >
          <div className="border-b border-[var(--border)] px-3 py-2">
            <p className="truncate text-sm font-medium">{email}</p>
            {orgName ? (
              <p className="truncate text-xs text-[var(--text-secondary)]">{orgName}</p>
            ) : null}
          </div>
          <Link
            role="menuitem"
            href="/app"
            className="block rounded-[8px] px-3 py-2 text-sm hover:bg-[var(--surface-subtle)]"
            onClick={() => setOpen(false)}
          >
            Кабинет
          </Link>
          {links.map((l) => (
            <Link
              key={l.href}
              role="menuitem"
              href={l.href}
              className="block rounded-[8px] px-3 py-2 text-sm hover:bg-[var(--surface-subtle)]"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <form action={signOutAction} className="border-t border-[var(--border)] pt-1">
            <button
              type="submit"
              role="menuitem"
              className="w-full rounded-[8px] px-3 py-2 text-left text-sm text-[var(--error)] hover:bg-[var(--surface-subtle)]"
            >
              Выйти
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
