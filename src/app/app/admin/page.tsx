import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { requirePlatformAdmin } from "@/modules/organizations/access";

const sections = [
  { href: "/app/admin/categories", label: "Категории" },
  { href: "/app/admin/units", label: "Единицы" },
  { href: "/app/admin/regions", label: "Регионы" },
  { href: "/app/admin/companies", label: "Компании" },
  { href: "/app/admin/moderation", label: "Модерация" },
  { href: "/app/admin/offers", label: "Предложения" },
  { href: "/app/admin/templates", label: "Шаблоны" },
  { href: "/app/admin/import", label: "Импорт прайса" },
  { href: "/app/admin/audit", label: "История" },
];

export default async function AdminHomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await requirePlatformAdmin(session.user.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Админ-панель</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Справочники, модерация, импорт. Загруженный файл сам по себе не означает
          проверенную лицензию.
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {sections.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 hover:border-[var(--accent)]"
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
