import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { CatalogFilters } from "@/components/CatalogFilters";
import { AddToEstimateButton } from "@/components/AddToEstimateButton";
import { EstimateSidePanel } from "@/components/EstimateSidePanel";
import { EstimateMobileChrome } from "@/components/EstimateMobileChrome";
import {
  Button,
  CatalogRow,
  Panel,
  PanelBody,
  PanelDivider,
  PanelToolbar,
  PanelToolbarRow,
  Workspace,
} from "@/components/ui";
import { serializeOfferPrice } from "@/modules/catalog/queries";
import {
  cachedCategoryFilters,
  cachedListNavigableCategories,
  cachedSearchCatalogItems,
} from "@/modules/catalog/cached";
import { prisma } from "@/lib/db";
import type { CatalogItemKind } from "@prisma/client";
import { auth } from "@/lib/auth";
import { listProjectsForUser } from "@/modules/projects/service";
import { addToEstimateAction } from "@/app/actions/estimate";

const UNIT_LABEL: Record<string, string> = {
  pcs: "шт.",
  m: "м",
  m2: "м²",
  kg: "кг",
  set: "компл.",
  point: "точка",
  visit: "выезд",
  hour: "час",
  contour: "контур",
  cable_line: "каб. линия",
};

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

function numericOfferPrice(offer: {
  priceType: string;
  price: { toString(): string } | null;
  priceMin: { toString(): string } | null;
}) {
  if (offer.priceType === "fixed" && offer.price != null) return offer.price.toString();
  if (offer.priceType === "from" && offer.priceMin != null) return offer.priceMin.toString();
  return null;
}

export async function CatalogPage({
  kind,
  searchParams,
}: {
  kind: CatalogItemKind;
  title?: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parseParams(kind, sp);
  const session = await auth();
  const [categories, result, cities, units, attrFilters, projects] = await Promise.all([
    cachedListNavigableCategories(kind),
    cachedSearchCatalogItems(params),
    prisma.city.findMany({ orderBy: { nameRu: "asc" } }),
    prisma.unit.findMany({ orderBy: { code: "asc" } }),
    cachedCategoryFilters(params.category),
    session?.user?.id
      ? listProjectsForUser(session.user.id).then((ps) =>
          ps.map((p) => ({ id: p.id, name: p.name })),
        )
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);

  const basePath = kind === "product" ? "/catalog/products" : "/catalog/services";
  const otherPath = kind === "product" ? "/catalog/services" : "/catalog/products";
  const importHref =
    projects.length > 0 ? "/app/import-draft" : session?.user ? "/app/projects" : "/app/import-draft";

  return (
    <>
      <SiteHeader />
      <Workspace>
        <main className="qh-catalog-col flex min-h-0 min-w-0 flex-col pb-0">
          <Panel padding="none" className="qh-catalog-panel" data-testid="catalog-panel">
            <PanelToolbar>
              <PanelToolbarRow>
                <div className="inline-flex rounded-[var(--radius-button)] border border-[var(--border)] bg-[var(--control)] p-0.5">
                  <Link
                    href="/catalog/products"
                    className={`min-h-10 rounded-[8px] px-3 text-sm font-medium leading-10 ${
                      kind === "product"
                        ? "bg-[var(--brand)] text-[var(--brand-foreground)]"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    Товары
                  </Link>
                  <Link
                    href="/catalog/services"
                    className={`min-h-10 rounded-[8px] px-3 text-sm font-medium leading-10 ${
                      kind === "service"
                        ? "bg-[var(--brand)] text-[var(--brand-foreground)]"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    Услуги
                  </Link>
                </div>
                <p className="shrink-0 text-sm text-[var(--text-secondary)]">Найдено: {result.total}</p>
              </PanelToolbarRow>

              <PanelToolbarRow className="items-stretch sm:items-center">
                <Suspense
                  fallback={<p className="text-sm text-[var(--text-secondary)]">Фильтры…</p>}
                >
                  <CatalogFilters
                    kind={kind}
                    categories={categories.map((c) => ({ slug: c.slug, nameRu: c.nameRu }))}
                    attributeFilters={attrFilters.map((a) => ({
                      code: a.code,
                      nameRu: a.code === "poles" ? "Число полюсов" : a.nameRu,
                      valueType: a.valueType,
                      enumOptions: a.enumOptions,
                    }))}
                    units={units.map((u) => ({ code: u.code, nameRu: u.nameRu }))}
                    cities={cities.map((c) => ({ id: c.id, nameRu: c.nameRu }))}
                  />
                </Suspense>
              </PanelToolbarRow>
            </PanelToolbar>

            <PanelDivider />

            <PanelBody>
              {result.items.length === 0 ? (
                <div className="px-6 py-10 text-center text-[var(--text-secondary)]" role="status">
                  <p>Ничего не найдено.</p>
                  <Link href={basePath} className="mt-3 inline-block text-sm font-medium underline">
                    Сбросить фильтры
                  </Link>
                </div>
              ) : (
                result.items.map((item) => {
                  const primary = item.offers[0];
                  const price = primary ? serializeOfferPrice(primary) : null;
                  const unitPrice = primary ? numericOfferPrice(primary) : null;
                  const attrs = item.attributes
                    .slice(0, 3)
                    .map((a) => `${a.attributeDefinition.nameRu}: ${a.value}`)
                    .join(" · ");
                  return (
                    <CatalogRow
                      key={item.id}
                      name={
                        <Link href={`/catalog/items/${item.id}`} className="hover:underline">
                          {item.name}
                        </Link>
                      }
                      meta={attrs || item.sku || item.category.nameRu}
                      price={unitPrice}
                      unit={UNIT_LABEL[item.baseUnit.code] ?? item.baseUnit.nameRu}
                      unknownPrice={!unitPrice}
                      supplier={primary?.supplier.name}
                      demo={item.isDemo}
                      action={
                        primary || item.kind === "service" ? (
                          <AddToEstimateButton
                            catalogItemId={item.id}
                            offerId={primary?.id}
                            name={item.name}
                            unit={item.baseUnit.code}
                            priceLabel={price?.label ?? "По запросу"}
                            unitPrice={unitPrice}
                            kind={item.kind}
                            projects={projects}
                            isAuthenticated={Boolean(session?.user)}
                            activeProjectId={projects[0]?.id}
                            addAction={addToEstimateAction}
                            compact
                          />
                        ) : (
                          <Link href={`/catalog/items/${item.id}`}>
                            <Button size="sm" variant="secondary">
                              Подробнее
                            </Button>
                          </Link>
                        )
                      }
                    />
                  );
                })
              )}

              {result.pageCount > 1 ? (
                <nav className="flex flex-wrap gap-2 px-6 py-4" aria-label="Страницы">
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
                        className={`rounded-[var(--radius-button)] px-3 py-1.5 text-sm ${
                          p === result.page
                            ? "bg-[var(--brand)] font-semibold text-[var(--brand-foreground)]"
                            : "border border-[var(--border)] bg-[var(--control)]"
                        }`}
                      >
                        {p}
                      </Link>
                    );
                  })}
                </nav>
              ) : null}

              <p className="px-6 pb-5 text-xs text-[var(--text-secondary)]">
                Учебные демо-цены.{" "}
                <Link href={otherPath} className="underline">
                  {kind === "product" ? "К услугам" : "К товарам"}
                </Link>
              </p>
            </PanelBody>
          </Panel>
        </main>

        <EstimateSidePanel
          isAuthenticated={Boolean(session?.user)}
          importHref={importHref}
        />
      </Workspace>
      <EstimateMobileChrome
        isAuthenticated={Boolean(session?.user)}
        importHref={importHref}
      />
    </>
  );
}
