import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { listTemplatesAdmin } from "@/modules/administration/refs";
import { updateTemplateAction } from "@/app/actions/admin";

export default async function AdminTemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const templates = await listTemplatesAdmin(session.user.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/app/admin" className="text-sm text-[var(--muted)]">
          ← Админ
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Шаблоны смет</h1>
        <ul className="mt-6 space-y-4">
          {templates.map((t) => (
            <li key={t.id} className="rounded border p-4 text-sm">
              <form action={updateTemplateAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={t.id} />
                <span className="text-[var(--muted)]">{t.code}</span>
                <input
                  name="nameRu"
                  defaultValue={t.nameRu}
                  className="rounded border px-2 py-1"
                />
                <input
                  name="description"
                  defaultValue={t.description ?? ""}
                  className="min-w-[200px] flex-1 rounded border px-2 py-1"
                />
                <button type="submit" className="rounded border px-2 py-1">
                  Сохранить
                </button>
              </form>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
