"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button, FilterChip, Input, Select } from "@/components/ui";

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

/** Filter controls for embedding inside catalog PanelToolbar (no outer panel) */
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, []);

  const activeChips: { key: string; label: string }[] = [];
  if (searchParams.get("category")) {
    const cat = categories.find((c) => c.slug === searchParams.get("category"));
    activeChips.push({ key: "category", label: cat?.nameRu ?? "Категория" });
  }
  if (searchParams.get("cityId")) {
    const city = cities.find((c) => c.id === searchParams.get("cityId"));
    activeChips.push({ key: "cityId", label: city?.nameRu ?? "Город" });
  }
  for (const attr of attributeFilters) {
    if (searchParams.get(attr.code)) {
      activeChips.push({
        key: attr.code,
        label: `${attr.nameRu}: ${searchParams.get(attr.code)}`,
      });
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3" aria-busy={pending}>
      <div className="flex w-full min-w-0 flex-wrap items-center gap-3">
        <div className="min-w-0 flex-[1.4] basis-[12rem]">
          <Input
            type="search"
            value={q}
            aria-label="Поиск"
            placeholder={kind === "product" ? "Найти товар…" : "Найти услугу…"}
            onChange={(e) => {
              const value = e.target.value;
              setQ(value);
              if (debounce.current) clearTimeout(debounce.current);
              debounce.current = setTimeout(() => update({ q: value || null }), 280);
            }}
          />
        </div>
        <Select
          aria-label="Категория"
          value={searchParams.get("category") ?? ""}
          onChange={(e) => update({ category: e.target.value || null })}
          className="min-w-0 max-w-full flex-1 basis-[8rem] sm:max-w-[14rem] sm:flex-none"
        >
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.nameRu}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={() => setMoreOpen((v) => !v)}
        >
          Фильтры{activeChips.length > 0 ? ` · ${activeChips.length}` : ""}
        </Button>
        {activeChips.length > 0 || searchParams.get("q") ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setQ("");
              startTransition(() => router.push(pathname));
            }}
          >
            Сбросить
          </Button>
        ) : null}
      </div>

      {activeChips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {activeChips.map((c) => (
            <FilterChip key={c.key} active onRemove={() => update({ [c.key]: null })}>
              {c.label}
            </FilterChip>
          ))}
        </div>
      ) : null}

      {moreOpen ? (
        <div className="grid gap-3 border-t border-[var(--border)] pt-3 sm:grid-cols-2 lg:grid-cols-3">
          {cities.length > 0 ? (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Город</span>
              <Select
                value={searchParams.get("cityId") ?? ""}
                onChange={(e) => update({ cityId: e.target.value || null })}
              >
                <option value="">Любой</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameRu}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
          {units.length > 0 ? (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Единица</span>
              <Select
                value={searchParams.get("unit") ?? ""}
                onChange={(e) => update({ unit: e.target.value || null })}
              >
                <option value="">Любая</option>
                {units.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.nameRu}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
          {attributeFilters.map((attr) => {
            const opts = Array.isArray(attr.enumOptions)
              ? (attr.enumOptions as string[])
              : null;
            return (
              <label key={attr.code} className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">{attr.nameRu}</span>
                {opts ? (
                  <Select
                    value={searchParams.get(attr.code) ?? ""}
                    onChange={(e) => update({ [attr.code]: e.target.value || null })}
                  >
                    <option value="">Любое</option>
                    {opts.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    defaultValue={searchParams.get(attr.code) ?? ""}
                    onBlur={(e) => update({ [attr.code]: e.target.value || null })}
                  />
                )}
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
