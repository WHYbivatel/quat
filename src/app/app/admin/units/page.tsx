import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { listUnitsAdmin } from "@/modules/administration/refs";
import { upsertUnitAction } from "@/app/actions/admin";

export default async function AdminUnitsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const units = await listUnitsAdmin(session.user.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/app/admin" className="text-sm text-[var(--muted)]">
          ← Админ
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Единицы</h1>
        <form action={upsertUnitAction} className="mt-4 flex flex-wrap gap-2 border p-4 text-sm">
          <input name="code" placeholder="code" required className="rounded border px-2 py-1" />
          <input name="nameRu" placeholder="Название" required className="rounded border px-2 py-1" />
          <input name="dimension" placeholder="dimension" className="rounded border px-2 py-1" />
          <button type="submit" className="rounded bg-[var(--accent)] px-3 py-1 text-white">
            Добавить
          </button>
        </form>
        <ul className="mt-6 space-y-1 text-sm">
          {units.map((u) => (
            <li key={u.id}>
              <code>{u.code}</code> — {u.nameRu}
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
