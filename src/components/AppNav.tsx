"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";

const links = [
  { href: "/catalog/products", label: "Каталог", match: (p: string) => p.startsWith("/catalog") },
  { href: "/app/projects", label: "Мои сметы", match: (p: string) => p.startsWith("/app/projects") || p.includes("/estimates/") },
];

export function AppNav({ className, mobile }: { className?: string; mobile?: boolean }) {
  const pathname = usePathname() || "";

  return (
    <nav
      className={cn(
        mobile
          ? "flex gap-4 overflow-x-auto border-t border-[var(--border)] px-[var(--workspace-pad-mobile)] py-2 text-sm sm:hidden"
          : "hidden items-center gap-5 text-sm sm:flex",
        className,
      )}
      aria-label={mobile ? "Мобильная" : "Основная"}
    >
      {links.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap py-1 transition-colors",
              active
                ? "border-b border-[var(--text-primary)] font-semibold text-[var(--text-primary)]"
                : "border-b border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
