"use server";

import { auth } from "@/lib/auth";
import { updateOwnOffer, updateSupplierOrgProfile } from "@/modules/offers/service";
import {
  acceptResponseIntoDraft,
  markRequestViewed,
  previewRequestsFromVersion,
  respondToRequest,
  submitProcurementRequests,
} from "@/modules/requests/service";
import { AccessDeniedError, NotFoundError } from "@/lib/permissions";
import type { AvailabilityStatus, PriceType, VatMode } from "@prisma/client";

type Err = { ok: false; error: string };
type Ok<T = Record<string, unknown>> = { ok: true } & T;

function fail(e: unknown): Err {
  if (e instanceof AccessDeniedError || e instanceof NotFoundError) {
    return { ok: false, error: e.message };
  }
  console.error(e);
  return { ok: false, error: "Операция не выполнена" };
}

async function uid() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function previewRequestsAction(versionId: string) {
  const userId = await uid();
  if (!userId) return { ok: false as const, error: "Нужен вход" };
  try {
    const preview = await previewRequestsFromVersion(userId, versionId);
    return { ok: true as const, preview };
  } catch (e) {
    return fail(e);
  }
}

export async function submitRequestsAction(
  formData: FormData,
): Promise<Ok<{ count: number; duplicated: boolean }> | Err> {
  const userId = await uid();
  if (!userId) return { ok: false, error: "Нужен вход" };
  try {
    const versionId = String(formData.get("versionId") ?? "");
    const idempotencyKey = String(formData.get("idempotencyKey") ?? "") || undefined;
    const raw = String(formData.get("assignments") ?? "[]");
    const assignments = JSON.parse(raw) as Array<{
      supplierOrganizationId: string;
      estimateLineIds: string[];
    }>;
    const result = await submitProcurementRequests({
      userId,
      versionId,
      assignments,
      idempotencyKey,
      objectInfoVisible: {
        contactVisible: formData.get("contactVisible") === "1",
      },
    });
    return {
      ok: true,
      count: result.requests.length,
      duplicated: result.duplicated,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function respondRequestAction(formData: FormData) {
  const userId = await uid();
  if (!userId) throw new Error("Нужен вход");
  await respondToRequest({
    userId,
    requestId: String(formData.get("requestId") ?? ""),
    proposedPrice: String(formData.get("proposedPrice") ?? "") || null,
    proposedLeadTimeDays: formData.get("proposedLeadTimeDays")
      ? Number(formData.get("proposedLeadTimeDays"))
      : null,
    proposedAvailability: (String(formData.get("proposedAvailability") || "") ||
      null) as AvailabilityStatus | null,
    alternativeCatalogItemId:
      String(formData.get("alternativeCatalogItemId") ?? "") || null,
    message: String(formData.get("message") ?? "") || null,
    decline: formData.get("decline") === "1",
  });
  const { redirect } = await import("next/navigation");
  redirect(`/app/supplier/requests/${String(formData.get("requestId"))}`);
}

export async function acceptResponseAction(formData: FormData) {
  const userId = await uid();
  if (!userId) throw new Error("Нужен вход");
  const result = await acceptResponseIntoDraft({
    userId,
    requestId: String(formData.get("requestId") ?? ""),
    responseVersion: Number(formData.get("responseVersion")),
    acceptAlternative: formData.get("acceptAlternative") === "1",
  });
  const { redirect } = await import("next/navigation");
  redirect(`/app/projects/${result.projectId}/estimates/${result.draftEstimateId}`);
}

export async function markViewedAction(requestId: string) {
  const userId = await uid();
  if (!userId) return;
  try {
    await markRequestViewed(userId, requestId);
  } catch {
    // ignore
  }
}

export async function updateOfferAction(formData: FormData) {
  const userId = await uid();
  if (!userId) throw new Error("Нужен вход");
  const offer = await updateOwnOffer({
    userId,
    offerId: String(formData.get("offerId") ?? ""),
    data: {
      priceType: String(formData.get("priceType") ?? "") as PriceType,
      price: String(formData.get("price") ?? "") || null,
      inputVatMode: String(formData.get("inputVatMode") ?? "") as VatMode,
      inputVatRate: String(formData.get("inputVatRate") ?? "") || null,
      availability: String(formData.get("availability") ?? "") as never,
      moq: String(formData.get("moq") ?? "") || null,
      packQty: String(formData.get("packQty") ?? "") || null,
      leadTimeDays: formData.get("leadTimeDays")
        ? Number(formData.get("leadTimeDays"))
        : null,
      validUntil: String(formData.get("validUntil") ?? "") || null,
      unknownPriceReason: String(formData.get("unknownPriceReason") ?? "") || null,
    },
  });
  const { invalidateCache } = await import("@/modules/cache/invalidate");
  const { cacheTags } = await import("@/modules/cache/tags");
  await invalidateCache({
    tags: [
      cacheTags.catalog,
      cacheTags.offer(offer.id),
      cacheTags.item(offer.catalogItemId),
    ],
    paths: [
      `/catalog/items/${offer.catalogItemId}`,
      "/catalog/products",
      "/catalog/services",
      "/suppliers",
    ],
  });
  const { redirect } = await import("next/navigation");
  redirect("/app/supplier/offers");
}

export async function updateSupplierProfileAction(formData: FormData) {
  const userId = await uid();
  if (!userId) throw new Error("Нужен вход");
  await updateSupplierOrgProfile({
    userId,
    name: String(formData.get("name") ?? "") || undefined,
    bin: String(formData.get("bin") ?? "") || null,
  });
  const { redirect } = await import("next/navigation");
  redirect("/app/supplier/offers");
}
