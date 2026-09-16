import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { EstimateWorkspace } from "@/components/EstimateWorkspace";
import {
  addAdjustmentAction,
  addManualLineAction,
  applyPricesAction,
  comparePricesAction,
  createPublicLinkAction,
  duplicateEstimateAction,
  duplicateSectionAction,
  issueVersionAction,
  removeLineAction,
  saveLineFieldsAction,
  saveMetaAction,
  updateLineQtyAction,
} from "@/app/actions/estimate";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEstimateWorkspace } from "@/modules/estimates/draft";
import { findPossibleDuplicates } from "@/modules/estimates/editor";
import { buildCalcInputFromDraft } from "@/modules/pricing/from-draft";
import { getProjectForUser } from "@/modules/projects/service";

export default async function EstimatePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; estimateId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { projectId, estimateId } = await params;
  const sp = await searchParams;

  await getProjectForUser(session.user.id, projectId);
  const estimate = await getEstimateWorkspace(session.user.id, estimateId);
  if (estimate.projectId !== projectId) redirect("/app/projects");

  const catalogHits = await prisma.catalogItem.findMany({
    where: { status: "active", category: { isNavigable: true } },
    include: { baseUnit: true },
    orderBy: { name: "asc" },
    take: 24,
  });

  const { result: calc } = buildCalcInputFromDraft({
    lines: estimate.lines,
    adjustments: estimate.adjustments,
  });
  const warnings = await findPossibleDuplicates(estimate.id);

  return (
    <>
      <SiteHeader />
      <EstimateWorkspace
        projectId={projectId}
        estimateId={estimateId}
        draftRevision={estimate.draftRevision}
        estimateTitle={estimate.title}
        projectName={estimate.project.name}
        objectName={estimate.project.objectName}
        clientName={estimate.project.clientName}
        assumptions={estimate.project.assumptions}
        terms={estimate.terms}
        exclusions={estimate.exclusions}
        proposalStatus={estimate.proposalStatus}
        sections={estimate.sections.map((s) => ({ id: s.id, title: s.title }))}
        lines={estimate.lines.map((l) => ({
          id: l.id,
          sectionId: l.sectionId,
          nameSnapshot: l.nameSnapshot,
          unitSnapshot: l.unitSnapshot,
          qty: l.qty.toString(),
          unitSalePrice: l.unitSalePrice?.toString() ?? null,
          unitPurchasePrice: l.unitPurchasePrice?.toString() ?? null,
          discountPercent: l.discountPercent?.toString() ?? null,
          unknownPriceReason: l.unknownPriceReason,
          supplierNameSnapshot: l.supplierNameSnapshot,
          costType: l.costType,
          priceType: l.priceType,
          offerId: l.offerId,
        }))}
        adjustments={estimate.adjustments.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          value: a.value.toString(),
        }))}
        versions={estimate.versions.map((v) => ({
          id: v.id,
          versionNumber: v.versionNumber,
          issuedAt: v.issuedAt.toISOString(),
          documentKind: v.documentKind,
        }))}
        warnings={warnings}
        knownSubtotal={calc.knownSubtotal}
        unknownCount={calc.unknownLineCount}
        complete={calc.complete}
        grandTotal={calc.grandTotal}
        outputVatTotal={calc.outputVatTotal}
        policyVersion={calc.calculationPolicyVersion}
        blockedForFixed={calc.blockedForFixedVersion}
        catalogHits={catalogHits.map((c) => ({
          id: c.id,
          name: c.name,
          sku: c.sku,
          unit: c.baseUnit.code,
          kind: c.kind,
        }))}
        view={sp.view === "client" ? "client" : "internal"}
        actions={{
          updateQty: updateLineQtyAction,
          removeLine: removeLineAction,
          saveLine: saveLineFieldsAction,
          addManual: addManualLineAction,
          addAdjustment: addAdjustmentAction,
          duplicateSection: duplicateSectionAction,
          duplicateEstimate: duplicateEstimateAction,
          saveMeta: saveMetaAction,
          issueVersion: issueVersionAction,
          comparePrices: comparePricesAction,
          applyPrices: applyPricesAction,
          createPublicLink: createPublicLinkAction,
        }}
      />
    </>
  );
}
