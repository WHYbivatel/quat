import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { listSupplierRequests } from "@/modules/requests/service";

export default async function SupplierRequestsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const requests = await listSupplierRequests(session.user.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Входящие заявки
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Видны только ваши строки. Цены перепродажи и чужие позиции скрыты.
        </p>
        <ul className="mt-6 space-y-3">
          {requests.length === 0 ? (
            <li className="text-sm text-[var(--muted)]">Входящих заявок нет.</li>
          ) : (
            requests.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"
              >
                <div>
                  <div className="font-semibold">От {r.buyerOrganization.name}</div>
                  <div className="text-[var(--muted)]">
                    {r.status} · {r.lines.length} поз. ·{" "}
                    {r.createdAt.toISOString().slice(0, 10)}
                  </div>
                </div>
                <Link
                  href={`/app/supplier/requests/${r.id}`}
                  className="rounded-md bg-[var(--accent)] px-3 py-1.5 font-semibold text-white"
                >
                  Открыть
                </Link>
              </li>
            ))
          )}
        </ul>
      </main>
    </>
  );
}
