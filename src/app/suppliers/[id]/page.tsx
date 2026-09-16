import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import {
  getSupplierProfile,
  serializeOfferPrice,
} from "@/modules/catalog/queries";

export default async function SupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getSupplierProfile(id);
  if (!profile) notFound();

  const { organization, offers } = profile;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <p className="text-sm text-[var(--muted)]">
          <Link href="/catalog/products">← Каталог</Link>
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
          {organization.name}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Тип: {organization.type}
          {organization.isDemo ? " · демо-компания" : null}
        </p>
        <p className="mt-3 max-w-2xl text-sm text-[var(--muted)]">
          Профиль поставщика/подрядчика. Отзывы, лицензии и партнёрства не
          публикуются без проверки источника. Оплата на платформе в MVP не
          выполняется.
        </p>

        <h2 className="mt-8 font-semibold">Актуальные предложения</h2>
        {offers.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">Нет предложений.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                  <th className="px-3 py-2 font-medium">Позиция</th>
                  <th className="px-3 py-2 font-medium">Ед.</th>
                  <th className="px-3 py-2 font-medium">Цена</th>
                  <th className="px-3 py-2 font-medium">Регионы</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => {
                  const price = serializeOfferPrice(o);
                  return (
                    <tr key={o.id} className="border-b border-[var(--border)]">
                      <td className="px-3 py-2">
                        <Link
                          href={`/catalog/items/${o.catalogItemId}`}
                          className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                        >
                          {o.catalogItem.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{o.catalogItem.baseUnit.nameRu}</td>
                      <td className="px-3 py-2">
                        {price.label}
                        <div className="text-xs text-[var(--muted)]">{price.vatLabel}</div>
                      </td>
                      <td className="px-3 py-2 text-[var(--muted)]">
                        {o.cities.map((c) => c.city.nameRu).join(", ") || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
