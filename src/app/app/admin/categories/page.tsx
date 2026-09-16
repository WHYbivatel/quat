import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { listCategoriesAdmin } from "@/modules/administration/refs";
import { upsertCategoryAction } from "@/app/actions/admin";
import Link from "next/link";

export default async function AdminCategoriesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const cats = await listCategoriesAdmin(session.user.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/app/admin" className="text-sm text-[var(--muted)]">
          ← Админ
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Категории</h1>
        <form
          action={upsertCategoryAction}
          className="mt-4 flex flex-wrap gap-2 rounded-lg border p-4 text-sm"
        >
          <input name="slug" placeholder="slug" required className="rounded border px-2 py-1" />
          <input name="nameRu" placeholder="Название RU" required className="rounded border px-2 py-1" />
          <select name="kind" className="rounded border px-2 py-1">
            <option value="product">product</option>
            <option value="service">service</option>
          </select>
          <label className="flex items-center gap-1">
            <input type="checkbox" name="isNavigable" value="1" defaultChecked />
            navigable
          </label>
          <button type="submit" className="rounded bg-[var(--accent)] px-3 py-1 text-white">
            Добавить
          </button>
        </form>
        <ul className="mt-6 space-y-2 text-sm">
          {cats.map((c) => (
            <li key={c.id} className="flex justify-between border-b py-2">
              <span>
                {c.nameRu} <span className="text-[var(--muted)]">/{c.slug}</span>
              </span>
              <span className="text-[var(--muted)]">
                {c.kind} · {c._count.items} поз.
              </span>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
