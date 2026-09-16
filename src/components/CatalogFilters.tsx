"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";

type FilterDef = {
  code: string;
  nameRu: string;
  valueType: string;
  enumOptions: unknown;
};

type Props = {
  kind: "product" | "service";
  categories: { slug: string; nameRu: string }[];
  attributeFilters: FilterDef[];
  units?: { code: string; nameRu: string }[];
  cities?: { id: string; nameRu: string }[];
};

export function CatalogFilters({
  kind,
  categories,
  attributeFilters,
  units = [],
  cities = [],
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") next.delete(k);
        else next.set(k, v);
      }
      if (!("page" in patch)) next.delete("page");
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`);
      });
    },
    [pathname, router, searchParams],
  );

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const patch: Record<string, string | null> = {
          q: String(fd.get("q") ?? "") || null,
          category: String(fd.get("category") ?? "") || null,
          cityId: String(fd.get("cityId") ?? "") || null,
          unit: String(fd.get("unit") ?? "") || null,
        };
        for (const attr of attributeFilters) {
          patch[attr.code] = String(fd.get(attr.code) ?? "") || null;
        }
        update(patch);
      }}
      aria-busy={pending}
    >
      <div className="flex flex-wrap gap-2">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
          Поиск
          <input
            name="q"
            type="search"
            defaultValue={searchParams.get("q") ?? ""}
            placeholder={kind === "product" ? "Название, артикул…" : "Название услуги…"}
            className="rounded-md border border-[var(--border)] px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          />
        </label>
        <label className="flex min-w-[160px] flex-col gap-1 text-sm">
          Категория
          <select
            name="category"
            defaultValue={searchParams.get("category") ?? ""}
            className="rounded-md border border-[var(--border)] px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            <option value="">Все</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nameRu}
              </option>
            ))}
          </select>
        </label>
        {cities.length > 0 ? (
          <label className="flex min-w-[140px] flex-col gap-1 text-sm">
            Город
            <select
              name="cityId"
              defaultValue={searchParams.get("cityId") ?? ""}
              className="rounded-md border border-[var(--border)] px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            >
              <option value="">Любой</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameRu}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {kind === "service" && units.length > 0 ? (
          <label className="flex min-w-[120px] flex-col gap-1 text-sm">
            Единица
            <select
              name="unit"
              defaultValue={searchParams.get("unit") ?? ""}
              className="rounded-md border border-[var(--border)] px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            >
              <option value="">Любая</option>
              {units.map((u) => (
                <option key={u.code} value={u.code}>
                  {u.nameRu}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {attributeFilters.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
          {attributeFilters.map((attr) => {
            const options = Array.isArray(attr.enumOptions)
              ? (attr.enumOptions as string[])
              : null;
            return (
              <label key={attr.code} className="flex min-w-[120px] flex-col gap-1 text-sm">
                {attr.nameRu}
                {options ? (
                  <select
                    name={attr.code}
                    defaultValue={searchParams.get(attr.code) ?? ""}
                    className="rounded-md border border-[var(--border)] px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                  >
                    <option value="">Любой</option>
                    {options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={attr.code}
                    defaultValue={searchParams.get(attr.code) ?? ""}
                    inputMode={attr.valueType === "number" ? "decimal" : "text"}
                    className="rounded-md border border-[var(--border)] px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                  />
                )}
              </label>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-2)]"
        >
          {pending ? "Применяем…" : "Применить"}
        </button>
        <button
          type="button"
          className="rounded-md border border-[var(--border)] px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          onClick={() => {
            startTransition(() => router.push(pathname));
          }}
        >
          Сбросить
        </button>
      </div>
    </form>
  );
}
