import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { CatalogFilters } from "@/components/CatalogFilters";
import {
  serializeOfferPrice,
} from "@/modules/catalog/queries";
import {
  cachedCategoryFilters,
  cachedListNavigableCategories,
  cachedSearchCatalogItems,
} from "@/modules/catalog/cached";
import { prisma } from "@/lib/db";
import type { CatalogItemKind } from "@prisma/client";

function parseParams(
  kind: CatalogItemKind,
  sp: Record<string, string | string[] | undefined>,
) {
  const g = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    kind,
    q: g("q"),
    category: g("category"),
    page: g("page") ? Number(g("page")) : 1,
    cityId: g("cityId"),
    unit: g("unit"),
    conductor_material: g("conductor_material"),
    cores: g("cores"),
    cross_section_mm2: g("cross_section_mm2"),
    voltage_v: g("voltage_v"),
    poles: g("poles"),
    rated_current_a: g("rated_current_a"),
    trip_curve: g("trip_curve"),
  };
}

export async function CatalogPage({
  kind,
  title,
  searchParams,
}: {
  kind: CatalogItemKind;
  title: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parseParams(kind, sp);
  const [categories, result, cities, units, attrFilters] = await Promise.all([
    cachedListNavigableCategories(kind),
    cachedSearchCatalogItems(params),
    prisma.city.findMany({ orderBy: { nameRu: "asc" } }),
    prisma.unit.findMany({ orderBy: { code: "asc" } }),
    cachedCategoryFilters(params.category),
  ]);

  const basePath =
    kind === "product" ? "/catalog/products" : "/catalog/services";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Учебные демо-цены. Не рыночные и не нормативные. Совместимость оборудования
          не оценивается.
        </p>
        {typeof sp.projectId === "string" && sp.projectId ? (
          <p className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
            Добавление в проект сметы.{" "}
            <Link href="/app/projects" className="text-[var(--accent)] underline">
              К моим проектам
            </Link>
          </p>
        ) : null}

        <div className="mt-6">
          <Suspense fallback={<p className="text-sm text-[var(--muted)]">Загрузка фильтров…</p>}>
            <CatalogFilters
              kind={kind}
              categories={categories.map((c) => ({ slug: c.slug, nameRu: c.nameRu }))}
              attributeFilters={attrFilters.map((a) => ({
                code: a.code,
                nameRu: a.nameRu,
                valueType: a.valueType,
                enumOptions: a.enumOptions,
              }))}
              units={units.map((u) => ({ code: u.code, nameRu: u.nameRu }))}
              cities={cities.map((c) => ({ id: c.id, nameRu: c.nameRu }))}
            />
          </Suspense>
        </div>

        <p className="mt-4 text-sm text-[var(--muted)]" role="status">
          Найдено: {result.total} · стр. {result.page}/{result.pageCount}
        </p>

        {result.items.length === 0 ? (
          <div
            className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]"
            role="status"
          >
            Ничего не найдено. Измените фильтры или сбросьте их.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                  <th className="px-3 py-2 font-medium">Название</th>
                  <th className="px-3 py-2 font-medium">Категория</th>
                  <th className="px-3 py-2 font-medium">Ед.</th>
                  <th className="px-3 py-2 font-medium">Предложения</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => {
                  const offers = item.offers.slice(0, 2).map((o) => serializeOfferPrice(o));
                  return (
                    <tr key={item.id} className="border-b border-[var(--border)] align-top">
                      <td className="px-3 py-3">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-[var(--muted)]">{item.sku}</div>
                        {item.isDemo ? (
                          <span className="mt-1 inline-block text-xs text-[var(--accent-2)]">
                            демо
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">{item.category.nameRu}</td>
                      <td className="px-3 py-3">{item.baseUnit.nameRu}</td>
                      <td className="px-3 py-3">
                        {offers.length === 0 ? (
                          <span className="text-[var(--muted)]">нет предложений</span>
                        ) : (
                          <ul className="space-y-1">
                            {offers.map((o, i) => (
                              <li key={i}>
                                {o.label}
                                <span className="text-[var(--muted)]"> · {o.vatLabel}</span>
                                {o.expired ? (
                                  <span className="text-[var(--danger)]"> · просрочено</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link
                          href={`/catalog/items/${item.id}`}
                          className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                        >
                          Открыть
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {result.pageCount > 1 ? (
          <nav className="mt-4 flex gap-2" aria-label="Страницы">
            {Array.from({ length: result.pageCount }, (_, i) => i + 1).map((p) => {
              const qs = new URLSearchParams();
              for (const [k, v] of Object.entries(sp)) {
                if (typeof v === "string" && k !== "page") qs.set(k, v);
              }
              qs.set("page", String(p));
              return (
                <Link
                  key={p}
                  href={`${basePath}?${qs.toString()}`}
                  aria-current={p === result.page ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                    p === result.page
                      ? "bg-[var(--accent)] text-white"
                      : "border border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  {p}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </main>
    </>
  );
}
