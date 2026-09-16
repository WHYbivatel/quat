import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { listModerationQueue } from "@/modules/administration/moderation";
import { moderateOfferAction } from "@/app/actions/admin";

export default async function AdminModerationPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const queue = await listModerationQueue(session.user.id, "pending");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/app/admin" className="text-sm text-[var(--muted)]">
          ← Админ
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Очередь модерации</h1>
        <ul className="mt-6 space-y-3 text-sm">
          {queue.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-3">
              <div>
                <div className="font-medium">{o.catalogItem.name}</div>
                <div className="text-[var(--muted)]">
                  {o.supplier.name} · {o.priceType} {o.price?.toString() ?? "—"} ·{" "}
                  {o.supplierSku}
                </div>
              </div>
              <div className="flex gap-2">
                <form action={moderateOfferAction}>
                  <input type="hidden" name="offerId" value={o.id} />
                  <input type="hidden" name="status" value="approved" />
                  <button type="submit" className="rounded bg-[var(--accent)] px-2 py-1 text-white">
                    Approve
                  </button>
                </form>
                <form action={moderateOfferAction}>
                  <input type="hidden" name="offerId" value={o.id} />
                  <input type="hidden" name="status" value="rejected" />
                  <button type="submit" className="rounded border px-2 py-1">
                    Reject
                  </button>
                </form>
              </div>
            </li>
          ))}
          {queue.length === 0 && (
            <li className="text-[var(--muted)]">Очередь пуста</li>
          )}
        </ul>
      </main>
    </>
  );
}
