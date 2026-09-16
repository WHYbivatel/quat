import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { AddToEstimateButton } from "@/components/AddToEstimateButton";
import { addToEstimateAction } from "@/app/actions/estimate";
import { auth } from "@/lib/auth";
import {
  comparableUnitExVat,
  getCatalogItemById,
  serializeOfferPrice,
} from "@/modules/catalog/queries";
import { listProjectsForUser } from "@/modules/projects/service";

type Scope = {
  works?: string[];
  included?: string[];
  excluded?: string[];
  requiresSurvey?: boolean;
};

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getCatalogItemById(id);
  if (!item) notFound();

  const session = await auth();
  const projects = session?.user?.id
    ? await listProjectsForUser(session.user.id)
    : [];

  const scope = (item.serviceScope ?? null) as Scope | null;
  const comparable = item.offers
    .map((o) => ({
      offer: o,
      exVat: comparableUnitExVat(o),
      display: serializeOfferPrice(o),
    }))
    .filter((x) => x.exVat != null)
    .sort((a, b) => Number(a.exVat) - Number(b.exVat));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <p className="text-sm text-[var(--muted)]">
          <Link href={item.kind === "product" ? "/catalog/products" : "/catalog/services"}>
            ← Каталог
          </Link>
          {" · "}
          {item.category.nameRu}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
          {item.name}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {item.sku ? `Артикул: ${item.sku}` : null}
          {item.isDemo ? " · учебная позиция" : null}
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-semibold">Характеристики</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-[var(--muted)]">Единица</dt>
                <dd>{item.baseUnit.nameRu}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Тип</dt>
                <dd>{item.kind === "product" ? "Товар" : "Услуга"}</dd>
              </div>
              {item.attributes.map((a) => (
                <div key={a.id}>
                  <dt className="text-[var(--muted)]">
                    {a.attributeDefinition.nameRu}
                    {a.attributeDefinition.normalizedUnit
                      ? ` (${a.attributeDefinition.normalizedUnit.nameRu})`
                      : ""}
                  </dt>
                  <dd>{formatAttr(a.value, a.normalizedValue)}</dd>
                </div>
              ))}
            </dl>

            {item.description ? (
              <p className="mt-4 text-sm text-[var(--muted)]">{item.description}</p>
            ) : null}

            {item.kind === "service" && scope ? (
              <div className="mt-6 space-y-3 text-sm">
                <h3 className="font-semibold">Состав услуги</h3>
                {scope.works?.length ? (
                  <p>
                    <span className="text-[var(--muted)]">Работы: </span>
                    {scope.works.join(", ")}
                  </p>
                ) : null}
                {scope.included?.length ? (
                  <p>
                    <span className="text-[var(--muted)]">Включено: </span>
                    {scope.included.join(", ")}
                  </p>
                ) : null}
                {scope.excluded?.length ? (
                  <p>
                    <span className="text-[var(--muted)]">Исключено: </span>
                    {scope.excluded.join(", ")}
                  </p>
                ) : null}
                <p>
                  <span className="text-[var(--muted)]">Обследование: </span>
                  {scope.requiresSurvey ? "может потребоваться" : "не требуется по шаблону"}
                </p>
                <p className="text-[var(--muted)]">
                  Способ расчёта в MVP: коммерческая расценка подрядчика за единицу.
                </p>
              </div>
            ) : null}

            <p className="mt-6 text-xs text-[var(--muted)]">
              Подбор по характеристикам не является инженерным проектированием и не
              подтверждает безопасную совместимость.
            </p>
          </section>

          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-semibold">Предложения поставщиков</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Сравнение по сопоставимой единице без НДС, где возможно. Доставка и
              неизвестные условия не учтены — «самый дешёвый» не объявляется.
            </p>

            {item.offers.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--muted)]" role="status">
                Нет утверждённых предложений.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {item.offers.map((offer) => {
                  const price = serializeOfferPrice(offer);
                  const rankHint =
                    comparable.length > 1 &&
                    comparable[0]?.offer.id === offer.id &&
                    comparable[0].exVat != null
                      ? "Ниже по известной цене без НДС среди сопоставимых (без доставки)"
                      : null;
                  return (
                    <li
                      key={offer.id}
                      className="rounded-md border border-[var(--border)] p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link
                            href={`/suppliers/${offer.supplierOrganizationId}`}
                            className="font-medium text-[var(--accent-2)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                          >
                            {offer.supplier.name}
                          </Link>
                          {offer.isDemo ? (
                            <span className="ml-2 text-xs text-[var(--muted)]">демо</span>
                          ) : null}
                        </div>
                        <div className="text-right text-sm font-semibold">{price.label}</div>
                      </div>
                      <dl className="mt-2 grid grid-cols-2 gap-1 text-xs text-[var(--muted)]">
                        <div>НДС: {price.vatLabel}</div>
                        <div>Наличие: {offer.availability}</div>
                        <div>
                          Срок:{" "}
                          {offer.leadTimeDays != null
                            ? `${offer.leadTimeDays} дн.`
                            : "не указан"}
                        </div>
                        <div>
                          Обновлено:{" "}
                          {offer.updatedAt.toISOString().slice(0, 10)}
                        </div>
                        {price.packQty ? <div>Упаковка: {price.packQty}</div> : null}
                        {price.moq ? <div>MOQ: {price.moq}</div> : null}
                        {price.expired ? (
                          <div className="col-span-2 text-[var(--danger)]">
                            Срок действия цены истёк
                          </div>
                        ) : null}
                        {price.reason ? (
                          <div className="col-span-2">{price.reason}</div>
                        ) : null}
                        {rankHint ? (
                          <div className="col-span-2 text-[var(--accent)]">{rankHint}</div>
                        ) : null}
                      </dl>
                      <div className="mt-3">
                        <AddToEstimateButton
                          catalogItemId={item.id}
                          offerId={offer.id}
                          name={item.name}
                          unit={item.baseUnit.code}
                          priceLabel={price.label}
                          kind={item.kind}
                          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
                          isAuthenticated={Boolean(session?.user)}
                          addAction={addToEstimateAction}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <p className="mb-2 text-sm text-[var(--muted)]">
                Добавить без выбора предложения (цена неизвестна)
              </p>
              <AddToEstimateButton
                catalogItemId={item.id}
                name={item.name}
                unit={item.baseUnit.code}
                priceLabel="Цена по запросу"
                kind={item.kind}
                projects={projects.map((p) => ({ id: p.id, name: p.name }))}
                isAuthenticated={Boolean(session?.user)}
                addAction={addToEstimateAction}
              />
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function formatAttr(value: unknown, normalized: { toString(): string } | null) {
  if (normalized != null) return normalized.toString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}
