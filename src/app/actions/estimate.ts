"use server";

import { auth } from "@/lib/auth";
import { removeDraftLine, updateDraftLineQty } from "@/modules/estimates/draft";
import {
  addAdjustment,
  addManualLine,
  duplicateEstimate,
  duplicateSection,
  updateEstimateMeta,
  updateLineFields,
  updateProjectMeta,
} from "@/modules/estimates/editor";
import {
  applyOfferPriceUpdates,
  applyTemplate,
  compareOfferPrices,
} from "@/modules/estimates/price-refresh";
import {
  ConflictError,
  VersionBlockedError,
  createPublicLink,
  issueEstimateVersion,
  revokePublicLink,
} from "@/modules/estimates/versions";
import { AccessDeniedError, NotFoundError } from "@/lib/permissions";
import { addCatalogItemToDraft } from "@/modules/estimates/draft";

type OkRev = {
  ok: true;
  revision: number;
  href?: string;
  versionId?: string;
  versionNumber?: number;
  token?: string;
};
type Err = { ok: false; error: string; conflict?: boolean };

function fail(e: unknown): Err {
  if (e instanceof ConflictError) {
    return { ok: false, error: e.message, conflict: true };
  }
  if (e instanceof VersionBlockedError || e instanceof AccessDeniedError || e instanceof NotFoundError) {
    return { ok: false, error: e.message };
  }
  console.error(e);
  return { ok: false, error: "Операция не выполнена" };
}

async function uid() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function addToEstimateAction(
  formData: FormData,
): Promise<
  | { ok: true; href: string; estimateId: string; projectId: string }
  | { ok: false; error: string }
> {
  const userId = await uid();
  if (!userId) return { ok: false, error: "Нужен вход" };
  try {
    const result = await addCatalogItemToDraft({
      userId,
      projectId: String(formData.get("projectId") ?? ""),
      catalogItemId: String(formData.get("catalogItemId") ?? ""),
      offerId: formData.get("offerId") ? String(formData.get("offerId")) : undefined,
      qty: String(formData.get("qty") ?? "1"),
    });
    const href = `/app/projects/${result.projectId}/estimates/${result.estimateId}`;
    return {
      ok: true,
      href,
      estimateId: result.estimateId,
      projectId: result.projectId,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function updateLineQtyAction(
  formData: FormData,
): Promise<OkRev | Err> {
  const userId = await uid();
  if (!userId) return { ok: false, error: "Нужен вход" };
  try {
    const revision = await updateDraftLineQty({
      userId,
      lineId: String(formData.get("lineId") ?? ""),
      qty: String(formData.get("qty") ?? "1"),
      expectedRevision: Number(formData.get("expectedRevision") ?? 0) || undefined,
    });
    return { ok: true, revision };
  } catch (e) {
    return fail(e);
  }
}

export async function removeLineAction(formData: FormData): Promise<OkRev | Err> {
  const userId = await uid();
  if (!userId) return { ok: false, error: "Нужен вход" };
  try {
    const revision = await removeDraftLine({
      userId,
      lineId: String(formData.get("lineId") ?? ""),
      expectedRevision: Number(formData.get("expectedRevision") ?? 0) || undefined,
    });
    return { ok: true, revision };
  } catch (e) {
    return fail(e);
  }
}

export async function saveLineFieldsAction(formData: FormData): Promise<OkRev | Err> {
  const userId = await uid();
  if (!userId) return { ok: false, error: "Нужен вход" };
  try {
    const sale = formData.get("unitSalePrice");
    const revision = await updateLineFields({
      userId,
      lineId: String(formData.get("lineId") ?? ""),
      expectedRevision: Number(formData.get("expectedRevision")),
      qty: formData.get("qty") ? String(formData.get("qty")) : undefined,
      unitSalePrice: sale === null || sale === undefined ? undefined : String(sale) || null,
      discountPercent: formData.has("discountPercent")
        ? String(formData.get("discountPercent") || "") || null
        : undefined,
      offerId: formData.has("offerId")
        ? String(formData.get("offerId") || "") || null
        : undefined,
    });
    return { ok: true, revision };
  } catch (e) {
    return fail(e);
  }
}

export async function addManualLineAction(formData: FormData): Promise<OkRev | Err> {
  const userId = await uid();
  if (!userId) return { ok: false, error: "Нужен вход" };
  try {
    const revision = await addManualLine({
      userId,
      estimateId: String(formData.get("estimateId") ?? ""),
      expectedRevision: Number(formData.get("expectedRevision")),
      name: String(formData.get("name") ?? ""),
      unit: String(formData.get("unit") ?? "pcs"),
      qty: String(formData.get("qty") ?? "1"),
      costType: (String(formData.get("costType") ?? "other") as "other"),
      unitSalePrice: String(formData.get("unitSalePrice") ?? "") || null,
    });
    return { ok: true, revision };
  } catch (e) {
    return fail(e);
  }
}

export async function addAdjustmentAction(formData: FormData): Promise<OkRev | Err> {
  const userId = await uid();
  if (!userId) return { ok: false, error: "Нужен вход" };
  try {
    const revision = await addAdjustment({
      userId,
      estimateId: String(formData.get("estimateId") ?? ""),
      expectedRevision: Number(formData.get("expectedRevision")),
      name: String(formData.get("name") ?? "Доставка"),
      type: String(formData.get("type") ?? "amount") === "percent" ? "percent" : "amount",
      value: String(formData.get("value") ?? "0"),
    });
    return { ok: true, revision };
  } catch (e) {
    return fail(e);
  }
}

export async function duplicateSectionAction(formData: FormData): Promise<OkRev | Err> {
  const userId = await uid();
  if (!userId) return { ok: false, error: "Нужен вход" };
  try {
    const revision = await duplicateSection({
      userId,
      sectionId: String(formData.get("sectionId") ?? ""),
      expectedRevision: Number(formData.get("expectedRevision")),
    });
    return { ok: true, revision };
  } catch (e) {
    return fail(e);
  }
}

export async function duplicateEstimateAction(formData: FormData): Promise<OkRev | Err> {
  const userId = await uid();
  if (!userId) return { ok: false, error: "Нужен вход" };
  try {
    const created = await duplicateEstimate({
      userId,
      estimateId: String(formData.get("estimateId") ?? ""),
    });
    return {
      ok: true,
      revision: created.draftRevision,
      href: `/app/projects/${created.projectId}/estimates/${created.id}`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function saveMetaAction(formData: FormData): Promise<OkRev | Err> {
  const userId = await uid();
  if (!userId) return { ok: false, error: "Нужен вход" };
  try {
    await updateProjectMeta({
      userId,
      projectId: String(formData.get("projectId") ?? ""),
      name: String(formData.get("projectName") ?? "") || undefined,
      objectName: String(formData.get("objectName") ?? "") || undefined,
      clientName: String(formData.get("clientName") ?? "") || undefined,
      assumptions: String(formData.get("assumptions") ?? "") || undefined,
    });
    const revision = await updateEstimateMeta({
      userId,
      estimateId: String(formData.get("estimateId") ?? ""),
      expectedRevision: Number(formData.get("expectedRevision")),
      title: String(formData.get("title") ?? "") || undefined,
      terms: String(formData.get("terms") ?? "") || undefined,
      exclusions: String(formData.get("exclusions") ?? "") || undefined,
      proposalStatus: formData.get("proposalStatus")
        ? (String(formData.get("proposalStatus")) as "prepared")
        : undefined,
    });
    return { ok: true, revision };
  } catch (e) {
    return fail(e);
  }
}

export async function issueVersionAction(formData: FormData): Promise<OkRev | Err> {
  const userId = await uid();
  if (!userId) return { ok: false, error: "Нужен вход" };
  try {
    const estimateId = String(formData.get("estimateId") ?? "");
    const expectedRevision = Number(formData.get("expectedRevision"));
    const idempotencyKey =
      String(formData.get("idempotencyKey") || "") ||
      `issue:${estimateId}:r${expectedRevision}:${String(formData.get("allowPreliminary") ?? "0")}`;
    const result = await issueEstimateVersion({
      userId,
      estimateId,
      expectedRevision,
      allowPreliminary: String(formData.get("allowPreliminary") ?? "") === "1",
      idempotencyKey,
    });
    return {
      ok: true,
      revision: result.draftRevision,
      versionId: result.version.id,
      versionNumber: result.version.versionNumber,
      href: `/app/versions/${result.version.id}`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function createPublicLinkAction(formData: FormData): Promise<OkRev | Err> {
  const userId = await uid();
  if (!userId) return { ok: false, error: "Нужен вход" };
  try {
    const link = await createPublicLink({
      userId,
      versionId: String(formData.get("versionId") ?? ""),
      expiresInDays: formData.get("expiresInDays")
        ? Number(formData.get("expiresInDays"))
        : 30,
    });
    const { invalidateCache } = await import("@/modules/cache/invalidate");
    const { cacheTags } = await import("@/modules/cache/tags");
    await invalidateCache({
      tags: [cacheTags.publicEstimate(link.id)],
      paths: [`/p/${link.token}`],
    });
    return { ok: true, revision: 0, token: link.token };
  } catch (e) {
    return fail(e);
  }
}

export async function revokePublicLinkAction(formData: FormData): Promise<OkRev | Err> {
  const userId = await uid();
  if (!userId) return { ok: false, error: "Нужен вход" };
  try {
    const link = await revokePublicLink({
      userId,
      linkId: String(formData.get("linkId") ?? ""),
    });
    const { invalidateCache } = await import("@/modules/cache/invalidate");
    const { cacheTags } = await import("@/modules/cache/tags");
    await invalidateCache({
      tags: [cacheTags.publicEstimate(link.id)],
      paths: [`/p/${link.token}`],
    });
    return { ok: true, revision: 0 };
  } catch (e) {
    return fail(e);
  }
}

export async function comparePricesAction(estimateId: string) {
  const userId = await uid();
  if (!userId) return [];
  return compareOfferPrices(userId, estimateId);
}

export async function applyPricesAction(formData: FormData): Promise<OkRev | Err> {
  const userId = await uid();
  if (!userId) return { ok: false, error: "Нужен вход" };
  try {
    const lineIds = String(formData.get("lineIds") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const revision = await applyOfferPriceUpdates({
      userId,
      estimateId: String(formData.get("estimateId") ?? ""),
      expectedRevision: Number(formData.get("expectedRevision")),
      lineIds,
    });
    return { ok: true, revision };
  } catch (e) {
    return fail(e);
  }
}

export async function applyTemplateAction(formData: FormData): Promise<OkRev | Err> {
  const userId = await uid();
  if (!userId) return { ok: false, error: "Нужен вход" };
  try {
    const estimate = await applyTemplate({
      userId,
      projectId: String(formData.get("projectId") ?? ""),
      templateCode: String(formData.get("templateCode") ?? ""),
    });
    return {
      ok: true,
      revision: estimate.draftRevision,
      href: `/app/projects/${estimate.projectId}/estimates/${estimate.id}`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function importGuestDraftAction(formData: FormData): Promise<OkRev | Err> {
  const userId = await uid();
  if (!userId) return { ok: false, error: "Нужен вход" };
  try {
    const projectId = String(formData.get("projectId") ?? "");
    const raw = String(formData.get("payload") ?? "[]");
    const items = JSON.parse(raw) as Array<{
      catalogItemId: string;
      offerId?: string;
      qty?: string;
    }>;
    if (!Array.isArray(items) || items.length === 0) {
      return { ok: false, error: "Нет позиций для переноса" };
    }

    let estimateId = "";
    for (const item of items) {
      if (!item.catalogItemId) continue;
      const r = await addCatalogItemToDraft({
        userId,
        projectId,
        catalogItemId: item.catalogItemId,
        offerId: item.offerId,
        qty: item.qty ?? "1",
      });
      estimateId = r.estimateId;
    }
    if (!estimateId) return { ok: false, error: "Не удалось добавить позиции" };

    return {
      ok: true,
      revision: 0,
      href: `/app/projects/${projectId}/estimates/${estimateId}`,
    };
  } catch (e) {
    return fail(e);
  }
}
