import type { ExportDocumentModel } from "./sanitize";
import { escapeCsvField, sanitizeSpreadsheetText } from "./sanitize";

/**
 * CSV UTF-8 with BOM for Excel.
 * Separator: `;` (European/KZ Excel-friendly)
 * Decimal: `.` in numeric fields (written without quotes as numbers when possible)
 */
export function renderCsv(model: ExportDocumentModel): Buffer {
  const sep = ";";
  const lines: string[] = [];

  lines.push(
    [
      "section",
      "name",
      "unit",
      "qty",
      "unit_price",
      "discount",
      "line_net",
      "output_vat",
      ...(model.variant === "internal" ? ["purchase_price", "supplier"] : []),
    ].join(sep),
  );

  for (const r of model.rows) {
    const cols = [
      escapeCsvField(r.sectionTitle),
      escapeCsvField(r.name),
      escapeCsvField(r.unit),
      r.qty,
      r.unitPrice ?? "",
      escapeCsvField(r.discount ?? ""),
      r.lineNet ?? "",
      r.outputVat ?? "",
    ];
    if (model.variant === "internal") {
      cols.push(r.purchasePrice ?? "", escapeCsvField(r.supplier ?? ""));
    }
    lines.push(cols.join(sep));
  }

  lines.push("");
  lines.push(["totals_key", "value"].join(sep));
  lines.push(["lines_ex_vat", model.totals.linesExVat].join(sep));
  lines.push(["adjustments_ex_vat", model.totals.adjustmentsExVat].join(sep));
  lines.push(["output_vat_total", model.totals.outputVatTotal].join(sep));
  lines.push(["known_subtotal", model.totals.knownSubtotal].join(sep));
  lines.push(["grand_total", model.totals.grandTotal ?? ""].join(sep));
  lines.push(["currency", model.currency].join(sep));
  lines.push(["policy", model.policyVersion].join(sep));
  lines.push([
    "note",
    escapeCsvField(
      "Separator='; decimal=dot; UTF-8 BOM. Formula injection guarded on text fields.",
    ),
  ].join(sep));
  if (model.preliminary) {
    lines.push(["status", escapeCsvField("Предварительный расчёт")].join(sep));
  }
  if (model.internalNote) {
    lines.push(["internal", escapeCsvField(model.internalNote)].join(sep));
  }

  // ensure sanitize used (lint-friendly reference)
  void sanitizeSpreadsheetText;

  const body = lines.join("\r\n");
  return Buffer.from(`\uFEFF${body}`, "utf8");
}
