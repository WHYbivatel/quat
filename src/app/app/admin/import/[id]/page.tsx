import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { getImportJob } from "@/modules/administration/import-service";
import {
  IMPORT_CANONICAL_FIELDS,
  type ColumnMapping,
} from "@/modules/administration/import-parse";
import {
  cancelImportAction,
  commitImportAction,
  remapImportAction,
} from "@/app/actions/admin";
import type { PreviewRow } from "@/modules/administration/import-service";

export default async function ImportJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const sp = await searchParams;
  let job;
  try {
    job = await getImportJob(session.user.id, id);
  } catch {
    notFound();
  }

  const headers = (job.headers as string[]) ?? [];
  const mapping = (job.columnMapping as ColumnMapping) ?? {};
  const report = job.report as
    | { rows: PreviewRow[]; summary: Record<string, number>; applied?: unknown[] }
    | null;
  const rows = report?.rows ?? [];
  const summary = report?.summary ?? {};

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/app/admin/import" className="text-sm text-[var(--muted)]">
          ← Импорт
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{job.fileName}</h1>
        <p className="text-sm text-[var(--muted)]">
          status: {job.status}
          {sp.done ? " · применено" : ""}
        </p>

        {job.status !== "committed" && job.status !== "cancelled" && (
          <>
            <h2 className="mt-6 font-semibold">Сопоставление колонок</h2>
            <form action={remapImportAction} className="mt-2 space-y-2 text-sm">
              <input type="hidden" name="jobId" value={job.id} />
              {IMPORT_CANONICAL_FIELDS.map((field) => (
                <label key={field} className="flex items-center gap-2">
                  <span className="w-36">{field}</span>
                  <select
                    name={`map_${field}`}
                    defaultValue={mapping[field] ?? ""}
                    className="rounded border px-2 py-1"
                  >
                    <option value="">—</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <button type="submit" className="rounded border px-3 py-1">
                Пересчитать preview
              </button>
            </form>
          </>
        )}

        <div className="mt-6 text-sm">
          Итого: {summary.total ?? 0} · валидных {summary.valid ?? 0} · ошибок{" "}
          {summary.errors ?? 0} · review {summary.needs_review ?? 0}
        </div>

        <div className="mt-4 max-h-96 overflow-auto rounded border text-xs">
          <table className="w-full">
            <thead className="sticky top-0 bg-[var(--surface)]">
              <tr>
                <th className="p-2 text-left">#</th>
                <th className="p-2 text-left">name</th>
                <th className="p-2 text-left">match</th>
                <th className="p-2 text-left">ошибки</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rowNumber} className="border-t">
                  <td className="p-2">{r.rowNumber}</td>
                  <td className="p-2">{r.mapped.name}</td>
                  <td className="p-2">{r.match}</td>
                  <td className="p-2 text-red-700">
                    {r.errors.join("; ")}
                    {r.warnings.length ? ` · ${r.warnings.join("; ")}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {job.status === "previewed" && (
          <div className="mt-6 flex flex-wrap gap-3">
            <form action={commitImportAction}>
              <input type="hidden" name="jobId" value={job.id} />
              <input type="hidden" name="onlyValid" value="1" />
              <button
                type="submit"
                className="rounded bg-[var(--accent)] px-4 py-2 text-white"
              >
                Импортировать валидные (без review)
              </button>
            </form>
            <form action={cancelImportAction}>
              <input type="hidden" name="jobId" value={job.id} />
              <button type="submit" className="rounded border px-4 py-2">
                Отмена
              </button>
            </form>
          </div>
        )}
      </main>
    </>
  );
}
