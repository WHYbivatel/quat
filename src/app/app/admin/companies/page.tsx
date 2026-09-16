import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { listOrganizationsAdmin } from "@/modules/administration/orgs";
import {
  addVerificationAction,
  setOrgStatusAction,
} from "@/app/actions/admin";

export default async function AdminCompaniesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const orgs = await listOrganizationsAdmin(session.user.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/app/admin" className="text-sm text-[var(--muted)]">
          ← Админ
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Компании</h1>
        <p className="text-sm text-[var(--muted)]">
          Проверка имеет источник и дату. Файл документа сам по себе ≠ лицензия
          проверена.
        </p>
        <ul className="mt-6 space-y-6">
          {orgs.map((o) => (
            <li key={o.id} className="rounded-lg border border-[var(--border)] p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{o.name}</div>
                  <div className="text-[var(--muted)]">
                    {o.type} · {o.status} · BIN {o.bin ?? "—"} · offers{" "}
                    {o._count.offers}
                  </div>
                </div>
                <form action={setOrgStatusAction} className="flex gap-2">
                  <input type="hidden" name="organizationId" value={o.id} />
                  <input
                    type="hidden"
                    name="status"
                    value={o.status === "active" ? "suspended" : "active"}
                  />
                  <button type="submit" className="rounded border px-2 py-1">
                    {o.status === "active" ? "Suspend" : "Activate"}
                  </button>
                </form>
              </div>
              <ul className="mt-2 text-xs text-[var(--muted)]">
                {o.verifications.map((v) => (
                  <li key={v.id}>
                    {v.kind}: {v.isVerified ? "verified" : "not verified"} ·{" "}
                    {v.source} · {v.verifiedAt.toISOString().slice(0, 10)}
                    {v.documentName ? ` · file:${v.documentName}` : ""}
                  </li>
                ))}
              </ul>
              <form
                action={addVerificationAction}
                className="mt-3 flex flex-wrap gap-2 border-t pt-3"
              >
                <input type="hidden" name="organizationId" value={o.id} />
                <input
                  name="kind"
                  defaultValue="company"
                  className="rounded border px-2 py-1"
                  placeholder="kind"
                />
                <input
                  name="source"
                  required
                  placeholder="источник проверки"
                  className="rounded border px-2 py-1"
                />
                <input
                  name="verifiedAt"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="rounded border px-2 py-1"
                />
                <input
                  name="documentName"
                  placeholder="файл (не = verified)"
                  className="rounded border px-2 py-1"
                />
                <label className="flex items-center gap-1">
                  <input type="checkbox" name="isVerified" value="1" />
                  isVerified
                </label>
                <button type="submit" className="rounded bg-[var(--accent)] px-2 py-1 text-white">
                  Записать проверку
                </button>
              </form>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
