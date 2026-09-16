"use server";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { invalidateCache } from "@/modules/cache/invalidate";
import { cacheTags } from "@/modules/cache/tags";
import { upsertCategory, upsertUnit, updateTemplate } from "@/modules/administration/refs";
import {
  addOrganizationVerification,
  setOrganizationStatus,
} from "@/modules/administration/orgs";
import { setOfferModeration } from "@/modules/administration/moderation";
import {
  buildPreview,
  cancelImport,
  commitImport,
  createImportJob,
} from "@/modules/administration/import-service";
import type { CatalogItemKind } from "@prisma/client";
import type { ColumnMapping } from "@/modules/administration/import-parse";
import { AccessDeniedError, NotFoundError } from "@/lib/permissions";

async function uid() {
  const session = await auth();
  return session?.user?.id ?? null;
}

function rethrow(e: unknown): never {
  if (e instanceof AccessDeniedError || e instanceof NotFoundError) throw e;
  throw e instanceof Error ? e : new Error("Ошибка");
}

export async function upsertCategoryAction(formData: FormData) {
  const userId = await uid();
  if (!userId) throw new Error("Нужен вход");
  await upsertCategory(userId, {
    id: String(formData.get("id") || "") || undefined,
    slug: String(formData.get("slug") ?? ""),
    nameRu: String(formData.get("nameRu") ?? ""),
    kind: String(formData.get("kind") ?? "product") as CatalogItemKind,
    isNavigable: formData.get("isNavigable") === "1",
    sortOrder: Number(formData.get("sortOrder") || 0),
  });
  await invalidateCache({
    tags: [cacheTags.catalog, cacheTags.sitemap],
    paths: ["/app/admin/categories", "/catalog/products", "/catalog/services"],
  });
  redirect("/app/admin/categories");
}

export async function upsertUnitAction(formData: FormData) {
  const userId = await uid();
  if (!userId) throw new Error("Нужен вход");
  await upsertUnit(userId, {
    id: String(formData.get("id") || "") || undefined,
    code: String(formData.get("code") ?? ""),
    nameRu: String(formData.get("nameRu") ?? ""),
    dimension: String(formData.get("dimension") || "") || null,
  });
  await invalidateCache({
    tags: [cacheTags.catalog],
    paths: ["/app/admin/units"],
  });
  redirect("/app/admin/units");
}

export async function updateTemplateAction(formData: FormData) {
  const userId = await uid();
  if (!userId) throw new Error("Нужен вход");
  await updateTemplate(userId, String(formData.get("id") ?? ""), {
    nameRu: String(formData.get("nameRu") ?? ""),
    description: String(formData.get("description") || "") || null,
  });
  await invalidateCache({ paths: ["/app/admin/templates"] });
  redirect("/app/admin/templates");
}

export async function addVerificationAction(formData: FormData) {
  const userId = await uid();
  if (!userId) throw new Error("Нужен вход");
  await addOrganizationVerification({
    userId,
    organizationId: String(formData.get("organizationId") ?? ""),
    kind: String(formData.get("kind") ?? "company"),
    source: String(formData.get("source") ?? ""),
    verifiedAt: new Date(String(formData.get("verifiedAt") || Date.now())),
    isVerified: formData.get("isVerified") === "1",
    documentName: String(formData.get("documentName") || "") || null,
    notes: String(formData.get("notes") || "") || null,
  });
  await invalidateCache({ paths: ["/app/admin/companies"] });
  redirect("/app/admin/companies");
}

export async function setOrgStatusAction(formData: FormData) {
  const userId = await uid();
  if (!userId) throw new Error("Нужен вход");
  await setOrganizationStatus(
    userId,
    String(formData.get("organizationId") ?? ""),
    String(formData.get("status") ?? "active") as "active" | "suspended",
  );
  await invalidateCache({ paths: ["/app/admin/companies"] });
  redirect("/app/admin/companies");
}

export async function moderateOfferAction(formData: FormData) {
  const userId = await uid();
  if (!userId) throw new Error("Нужен вход");
  const offerId = String(formData.get("offerId") ?? "");
  await setOfferModeration({
    userId,
    offerId,
    status: String(formData.get("status") ?? "approved") as
      | "approved"
      | "rejected"
      | "pending",
  });
  await invalidateCache({
    tags: [cacheTags.catalog, cacheTags.offer(offerId)],
    paths: ["/app/admin/moderation", "/catalog/products", "/catalog/services"],
  });
  redirect("/app/admin/moderation");
}

export async function uploadImportAction(formData: FormData) {
  const userId = await uid();
  if (!userId) throw new Error("Нужен вход");
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Нужен файл");
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    const job = await createImportJob({
      userId,
      organizationId: String(formData.get("organizationId") ?? ""),
      fileName: file.name,
      buffer: buf,
    });
    await buildPreview({ userId, jobId: job.id });
    redirect(`/app/admin/import/${job.id}`);
  } catch (e) {
    // Next.js redirect throws a special error — must not swallow it
    if (
      e &&
      typeof e === "object" &&
      "digest" in e &&
      String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw e;
    }
    rethrow(e);
  }
}

export async function remapImportAction(formData: FormData) {
  const userId = await uid();
  if (!userId) throw new Error("Нужен вход");
  const jobId = String(formData.get("jobId") ?? "");
  const mapping: ColumnMapping = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("map_") && typeof v === "string" && v) {
      mapping[k.slice(4) as keyof ColumnMapping] = v;
    }
  }
  await buildPreview({ userId, jobId, columnMapping: mapping });
  redirect(`/app/admin/import/${jobId}`);
}

export async function commitImportAction(formData: FormData) {
  const userId = await uid();
  if (!userId) throw new Error("Нужен вход");
  const jobId = String(formData.get("jobId") ?? "");
  const onlyValid = formData.get("onlyValid") === "1";
  const rawRows = String(formData.get("rowNumbers") || "");
  const rowNumbers = rawRows
    ? rawRows.split(",").map((n) => Number(n)).filter((n) => !Number.isNaN(n))
    : undefined;
  await commitImport({
    userId,
    jobId,
    rowNumbers: onlyValid ? undefined : rowNumbers,
  });
  await invalidateCache({
    tags: [cacheTags.catalog, cacheTags.sitemap],
    paths: [
      "/app/admin/import",
      "/catalog/products",
      "/catalog/services",
    ],
  });
  redirect(`/app/admin/import/${jobId}?done=1`);
}

export async function cancelImportAction(formData: FormData) {
  const userId = await uid();
  if (!userId) throw new Error("Нужен вход");
  await cancelImport(userId, String(formData.get("jobId") ?? ""));
  redirect("/app/admin/import");
}

export async function republishSourcesAction() {
  const userId = await uid();
  if (!userId) throw new Error("Нужен вход");
  const { requirePlatformAdmin } = await import("@/modules/organizations/access");
  await requirePlatformAdmin(userId);
  const { publishCuratedPublicSources } = await import("@/modules/sources/publish");
  await publishCuratedPublicSources({ actorUserId: userId });
  redirect("/app/admin/sources");
}
