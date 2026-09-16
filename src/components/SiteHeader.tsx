import Link from "next/link";
import { auth, signOut } from "@/lib/auth";

const links = [
  { href: "/catalog/products", label: "Товары" },
  { href: "/catalog/services", label: "Услуги" },
  { href: "/app/projects", label: "Мои проекты" },
  { href: "/app/requests", label: "Заявки" },
  { href: "/app/supplier/offers", label: "Поставщик" },
  { href: "/app/supplier/requests", label: "Входящие" },
  { href: "/app/admin", label: "Админ" },
];

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold tracking-tight text-[var(--accent)]">
            QuatHub
          </Link>
          <nav className="hidden items-center gap-4 text-sm sm:flex" aria-label="Основная">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-[var(--muted)] hover:text-[var(--fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {session?.user ? (
            <>
              <Link
                href="/app"
                className="text-[var(--muted)] hover:text-[var(--fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                {session.user.email}
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button
                  type="submit"
                  className="rounded-md border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  Выйти
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-2)]"
            >
              Войти
            </Link>
          )}
        </div>
      </div>
      <nav
        className="flex gap-4 overflow-x-auto border-t border-[var(--border)] px-4 py-2 text-sm sm:hidden"
        aria-label="Мобильная"
      >
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="whitespace-nowrap text-[var(--muted)]">
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
