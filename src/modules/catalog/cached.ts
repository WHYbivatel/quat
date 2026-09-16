import { unstable_cache } from "next/cache";
import type { CatalogItemKind } from "@prisma/client";
import {
  getCategoryFilters,
  listNavigableCategories,
  searchCatalogItems,
  type CatalogSearchParams,
} from "@/modules/catalog/queries";
import { cacheTags } from "@/modules/cache/tags";

export const cachedListNavigableCategories = (kind?: CatalogItemKind) =>
  unstable_cache(
    () => listNavigableCategories(kind),
    ["catalog-categories", kind ?? "all"],
    { tags: [cacheTags.catalog], revalidate: 60 },
  )();

export const cachedSearchCatalogItems = (params: CatalogSearchParams) =>
  unstable_cache(
    () => searchCatalogItems(params),
    ["catalog-search", JSON.stringify(params)],
    {
      tags: [
        cacheTags.catalog,
        ...(params.category ? [`category-slug:${params.category}`] : []),
      ],
      revalidate: 60,
    },
  )();

export const cachedCategoryFilters = (categorySlug?: string) =>
  unstable_cache(
    () => getCategoryFilters(categorySlug),
    ["catalog-filters", categorySlug ?? "none"],
    {
      tags: [
        cacheTags.catalog,
        ...(categorySlug ? [`category-slug:${categorySlug}`] : []),
      ],
      revalidate: 60,
    },
  )();
