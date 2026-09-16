import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { listBuyerRequests } from "@/modules/requests/service";
import { acceptResponseAction } from "@/app/actions/requests";

export default async function BuyerRequestsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const requests = await listBuyerRequests(session.user.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Исходящие заявки
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Принятие ответа обновляет черновик сметы, не выпущенную версию. Не ЭЦП и не оплата.
        </p>
        <ul className="mt-6 space-y-3">
          {requests.length === 0 ? (
            <li className="text-sm text-[var(--muted)]">Заявок пока нет.</li>
          ) : (
            requests.map((r) => {
              const latest = r.responses[0];
              return (
                <li
                  key={r.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{r.supplierOrganization.name}</div>
                      <div className="text-[var(--muted)]">
                        статус: {r.status} · строк: {r.lines.length} · уведомление:{" "}
                        {r.notificationStatus}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        версия сметы v{r.estimateVersion.versionNumber}
                      </div>
                    </div>
                    <Link
                      className="text-[var(--accent)] underline"
                      href={`/app/versions/${r.estimateVersionId}`}
                    >
                      Версия
                    </Link>
                  </div>
                  {latest ? (
                    <div className="mt-3 rounded border border-[var(--border)] p-3">
                      <div>
                        Ответ v{latest.version}: цена {latest.proposedPrice?.toString() ?? "—"} ·
                        срок {latest.proposedLeadTimeDays ?? "—"} дн.
                      </div>
                      {latest.message ? (
                        <div className="text-[var(--muted)]">{latest.message}</div>
                      ) : null}
                      {r.status === "responded" ? (
                        <form action={acceptResponseAction} className="mt-2">
                          <input type="hidden" name="requestId" value={r.id} />
                          <input
                            type="hidden"
                            name="responseVersion"
                            value={String(latest.version)}
                          />
                          {latest.alternativeCatalogItemId ? (
                            <label className="mr-3 text-xs">
                              <input type="checkbox" name="acceptAlternative" value="1" /> Принять
                              альтернативу
                            </label>
                          ) : null}
                          <button
                            type="submit"
                            className="rounded-md bg-[var(--accent)] px-3 py-1 text-white"
                          >
                            Принять в черновик
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </main>
    </>
  );
}
