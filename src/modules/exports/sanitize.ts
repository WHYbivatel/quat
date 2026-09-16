/** Sanitize user text for spreadsheet/CSV formula injection. */
export function sanitizeSpreadsheetText(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) {
    return `'${s}`;
  }
  return s;
}

export function escapeCsvField(value: unknown, decimalComma = false): string {
  let s = sanitizeSpreadsheetText(value);
  if (decimalComma && /^-?\d+(\.\d+)?$/.test(s)) {
    // Keep numbers as numbers via writer; this is for text mode only
  }
  if (/[",\n\r]/.test(s)) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function safeFileBase(name: string): string {
  return name
    .replace(/[^\p{L}\p{N}\-_]+/gu, "_")
    .replace(/_+/g, "_")
    .slice(0, 80) || "estimate";
}

export type ExportVariant = "client" | "internal";
export type ExportFormat = "pdf" | "xlsx" | "docx" | "csv";

export type ExportRow = {
  sectionTitle: string;
  name: string;
  unit: string;
  qty: string;
  unitPrice: string | null;
  discount: string | null;
  lineNet: string | null;
  outputVat: string | null;
  costType: string;
  // internal only
  purchasePrice?: string | null;
  supplier?: string | null;
  notesInternal?: string | null;
};

export type ExportDocumentModel = {
  title: string;
  documentType: string;
  number: string;
  versionLabel: string;
  issuedAt: string;
  currency: string;
  city: string | null;
  objectName: string | null;
  clientName: string | null;
  composerName: string | null;
  terms: string | null;
  exclusions: string | null;
  offerValidUntil: string | null;
  assumptions: string | null;
  preliminary: boolean;
  variant: ExportVariant;
  policyVersion: string;
  rows: ExportRow[];
  adjustments: Array<{ name: string; amount: string; vat: string | null }>;
  unknownLines: Array<{ name: string; reason: string | null }>;
  totals: {
    linesExVat: string;
    adjustmentsExVat: string;
    outputVatTotal: string;
    knownSubtotal: string;
    grandTotal: string | null;
    complete: boolean;
  };
  internalNote?: string | null;
};
