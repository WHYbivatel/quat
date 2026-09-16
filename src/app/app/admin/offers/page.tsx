import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import {
  isOfferStale,
  listOffersAdmin,
  type OfferAdminFilter,
} from "@/modules/administration/moderation";

export default async function AdminOffersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const sp = await searchParams;
  const filter = (sp.filter as OfferAdminFilter) || "all";
  const offers = await listOffersAdmin(session.user.id, filter);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/app/admin" className="text-sm text-[var(--muted)]">
          ← Админ
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Предложения</h1>
        <div className="mt-3 flex gap-3 text-sm">
          {(["all", "stale", "no_price"] as const).map((f) => (
            <Link
              key={f}
              href={`/app/admin/offers?filter=${f}`}
              className={filter === f ? "font-semibold text-[var(--accent)]" : "text-[var(--muted)]"}
            >
              {f}
            </Link>
          ))}
        </div>
        <ul className="mt-6 space-y-2 text-sm">
          {offers.map((o) => (
            <li key={o.id} className="border-b py-2">
              {o.catalogItem.name} · {o.supplier.name} · {o.priceType}{" "}
              {o.price?.toString() ?? "нет цены"}
              {isOfferStale(o.validUntil) ? (
                <span className="ml-2 text-amber-700">устарело</span>
              ) : null}
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
