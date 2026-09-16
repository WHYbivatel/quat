import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { requirePlatformAdmin } from "@/modules/organizations/access";
import { prisma } from "@/lib/db";
import { uploadImportAction } from "@/app/actions/admin";

export default async function AdminImportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await requirePlatformAdmin(session.user.id);

  const suppliers = await prisma.organization.findMany({
    where: { type: { in: ["supplier", "contractor", "mixed"] } },
    orderBy: { name: "asc" },
  });
  const jobs = await prisma.importJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { organization: true },
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/app/admin" className="text-sm text-[var(--muted)]">
          ← Админ
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Импорт прайс-листа</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          CSV/XLSX → сопоставление → preview → commit только валидных строк.
          Формулы не вычисляются. Макросы не исполняются.
        </p>
        <p className="mt-2 text-sm">
          <a
            href="/api/admin/import-template"
            className="text-[var(--accent)] underline"
          >
            Скачать шаблон CSV
          </a>
        </p>
        <form
          action={uploadImportAction}
          encType="multipart/form-data"
          className="mt-6 flex flex-wrap gap-3 rounded-lg border p-4 text-sm"
        >
          <select name="organizationId" required className="rounded border px-2 py-1">
            <option value="">Поставщик…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input type="file" name="file" accept=".csv,.xlsx" required />
          <button type="submit" className="rounded bg-[var(--accent)] px-3 py-1.5 text-white">
            Загрузить и preview
          </button>
        </form>
        <h2 className="mt-8 font-semibold">Недавние задания</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {jobs.map((j) => (
            <li key={j.id}>
              <Link href={`/app/admin/import/${j.id}`} className="underline">
                {j.fileName}
              </Link>{" "}
              · {j.organization.name} · {j.status}
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
