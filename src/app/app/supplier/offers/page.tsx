import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { listOwnOffers } from "@/modules/offers/service";
import { updateOfferAction, updateSupplierProfileAction } from "@/app/actions/requests";
import { requireAuthContext } from "@/modules/organizations/access";

export default async function SupplierOffersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const ctx = await requireAuthContext(session.user.id, "offer:manage");
  const offers = await listOwnOffers(session.user.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Кабинет поставщика
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {ctx.organization.name} · чужие предложения редактировать нельзя
        </p>

        <form
          action={updateSupplierProfileAction}
          className="mt-6 flex flex-wrap gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"
        >
          <label>
            Название компании
            <input
              name="name"
              defaultValue={ctx.organization.name}
              className="mt-1 block rounded-md border px-2 py-1"
            />
          </label>
          <label>
            БИН
            <input
              name="bin"
              defaultValue={ctx.organization.bin ?? ""}
              className="mt-1 block rounded-md border px-2 py-1"
            />
          </label>
          <div className="flex items-end">
            <button type="submit" className="rounded-md border px-3 py-1.5">
              Сохранить профиль
            </button>
          </div>
        </form>

        <h2 className="mt-8 font-semibold">Мои предложения</h2>
        <p className="text-xs text-[var(--muted)]">
          Изменение цены отправляет предложение на модерацию (pending).
        </p>
        <ul className="mt-4 space-y-4">
          {offers.map((o) => (
            <li
              key={o.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"
            >
              <div className="font-medium">{o.catalogItem.name}</div>
              <div className="text-[var(--muted)]">
                {o.catalogItem.sku} · {o.moderationStatus} · {o.availability}
              </div>
              <form action={updateOfferAction} className="mt-3 grid gap-2 md:grid-cols-4">
                <input type="hidden" name="offerId" value={o.id} />
                <label>
                  Тип цены
                  <select
                    name="priceType"
                    defaultValue={o.priceType}
                    className="mt-1 w-full rounded-md border px-2 py-1"
                  >
                    <option value="fixed">fixed</option>
                    <option value="from">from</option>
                    <option value="range">range</option>
                    <option value="on_request">on_request</option>
                  </select>
                </label>
                <label>
                  Цена
                  <input
                    name="price"
                    defaultValue={o.price?.toString() ?? ""}
                    className="mt-1 w-full rounded-md border px-2 py-1"
                  />
                </label>
                <label>
                  НДС режим
                  <select
                    name="inputVatMode"
                    defaultValue={o.inputVatMode}
                    className="mt-1 w-full rounded-md border px-2 py-1"
                  >
                    <option value="excluded">excluded</option>
                    <option value="included">included</option>
                    <option value="zero">zero</option>
                    <option value="not_specified">not_specified</option>
                  </select>
                </label>
                <label>
                  Ставка НДС
                  <input
                    name="inputVatRate"
                    defaultValue={o.inputVatRate?.toString() ?? ""}
                    className="mt-1 w-full rounded-md border px-2 py-1"
                  />
                </label>
                <label>
                  MOQ
                  <input
                    name="moq"
                    defaultValue={o.moq?.toString() ?? ""}
                    className="mt-1 w-full rounded-md border px-2 py-1"
                  />
                </label>
                <label>
                  Упаковка
                  <input
                    name="packQty"
                    defaultValue={o.packQty?.toString() ?? ""}
                    className="mt-1 w-full rounded-md border px-2 py-1"
                  />
                </label>
                <label>
                  Срок, дн.
                  <input
                    name="leadTimeDays"
                    type="number"
                    defaultValue={o.leadTimeDays ?? ""}
                    className="mt-1 w-full rounded-md border px-2 py-1"
                  />
                </label>
                <label>
                  Наличие
                  <select
                    name="availability"
                    defaultValue={o.availability}
                    className="mt-1 w-full rounded-md border px-2 py-1"
                  >
                    <option value="in_stock">in_stock</option>
                    <option value="made_to_order">made_to_order</option>
                    <option value="limited">limited</option>
                    <option value="unknown">unknown</option>
                  </select>
                </label>
                <label className="md:col-span-2">
                  validUntil (ISO)
                  <input
                    name="validUntil"
                    defaultValue={o.validUntil?.toISOString() ?? ""}
                    className="mt-1 w-full rounded-md border px-2 py-1"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-white"
                  >
                    Сохранить
                  </button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
