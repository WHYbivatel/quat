import ExcelJS from "exceljs";

export const IMPORT_CANONICAL_FIELDS = [
  "supplierSku",
  "name",
  "category",
  "unit",
  "priceType",
  "price",
  "currency",
  "vatMode",
  "vatRate",
  "region",
  "availability",
  "leadTimeDays",
  "moq",
  "packQty",
  "validUntil",
  "catalogSku",
] as const;

export type ImportCanonicalField = (typeof IMPORT_CANONICAL_FIELDS)[number];

export type ColumnMapping = Partial<Record<ImportCanonicalField, string>>;

const HEADER_ALIASES: Record<string, ImportCanonicalField> = {
  suppliersku: "supplierSku",
  "артикул поставщика": "supplierSku",
  артикул: "supplierSku",
  sku: "supplierSku",
  name: "name",
  название: "name",
  наименование: "name",
  category: "category",
  категория: "category",
  unit: "unit",
  единица: "unit",
  ед: "unit",
  pricetype: "priceType",
  "тип цены": "priceType",
  price: "price",
  цена: "price",
  currency: "currency",
  валюта: "currency",
  vatmode: "vatMode",
  "ндс режим": "vatMode",
  vatrate: "vatRate",
  "ставка ндс": "vatRate",
  region: "region",
  регион: "region",
  availability: "availability",
  наличие: "availability",
  leadtimedays: "leadTimeDays",
  срок: "leadTimeDays",
  "срок поставки": "leadTimeDays",
  moq: "moq",
  packqty: "packQty",
  упаковка: "packQty",
  validuntil: "validUntil",
  "срок действия": "validUntil",
  catalogsku: "catalogSku",
  "sku каталога": "catalogSku",
};

export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

export function guessMapping(headers: string[]): ColumnMapping {
  const map: ColumnMapping = {};
  for (const h of headers) {
    const key = HEADER_ALIASES[normalizeHeader(h)];
    if (key && !map[key]) map[key] = h;
  }
  return map;
}

export function parseDecimalInput(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const normalized = s.replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Некорректное число: ${raw}`);
  }
  return normalized;
}

/** Reject / neutralize spreadsheet formula injection in imported text. */
export function sanitizeImportText(raw: unknown): string {
  let s = raw == null ? "" : String(raw).trim();
  if (/^[=+\-@\t\r]/.test(s)) {
    s = s.replace(/^[=+\-@\t\r]+/, "");
  }
  // strip control chars
  s = s.replace(/[\u0000-\u001f\u007f]/g, "");
  return s.slice(0, 500);
}

export function detectDangerousFormula(raw: unknown): boolean {
  const s = raw == null ? "" : String(raw);
  return /^[=+\-@]/.test(s.trim()) || /cmd\|/i.test(s);
}

export type ParsedSheet = {
  headers: string[];
  rows: Record<string, string>[];
};

export async function parseImportBuffer(
  buffer: Buffer,
  format: "csv" | "xlsx",
): Promise<ParsedSheet> {
  if (format === "csv") {
    return parseCsv(buffer.toString("utf8"));
  }
  return parseXlsx(buffer);
}

function parseCsv(text: string): ParsedSheet {
  // Strip BOM
  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const delim = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const headers = splitCsvLine(lines[0], delim).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], delim);
    if (cells.every((c) => !c.trim())) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

async function parseXlsx(buffer: Buffer): Promise<ParsedSheet> {
  const wb = new ExcelJS.Workbook();
  // exceljs reads values only — formulas are not evaluated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (wb.xlsx as any).load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col - 1] = String(cell.text ?? cell.value ?? "").trim();
  });
  // compact undefined holes
  const maxCol = headers.length;
  const compactHeaders = Array.from({ length: maxCol }, (_, i) => headers[i] || `col${i + 1}`);

  const rows: Record<string, string>[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, string> = {};
    let empty = true;
    compactHeaders.forEach((h, idx) => {
      const cell = row.getCell(idx + 1);
      let val = "";
      if (cell.value != null) {
        if (typeof cell.value === "object" && "result" in (cell.value as object)) {
          // formula cell — take cached result text only, never evaluate
          val = String((cell.value as { result?: unknown }).result ?? cell.text ?? "");
        } else if (typeof cell.value === "object" && "text" in (cell.value as object)) {
          val = String((cell.value as { text: string }).text);
        } else {
          val = String(cell.text ?? cell.value);
        }
      }
      if (val.trim()) empty = false;
      obj[h] = val;
    });
    if (!empty) rows.push(obj);
  });
  return { headers: compactHeaders.filter(Boolean), rows };
}

export function buildTemplateCsv(): string {
  const headers = [
    "supplierSku",
    "name",
    "category",
    "unit",
    "priceType",
    "price",
    "currency",
    "vatMode",
    "vatRate",
    "region",
    "availability",
    "leadTimeDays",
    "moq",
    "packQty",
    "validUntil",
    "catalogSku",
  ];
  const sample = [
    "SUP-001",
    "Кабель ВВГнг 3×2.5",
    "cable",
    "m",
    "fixed",
    "850,50",
    "KZT",
    "excluded",
    "12",
    "almaty",
    "in_stock",
    "5",
    "100",
    "100",
    "2027-01-01",
    "CBL-VVG-3X2.5",
  ];
  return `${headers.join(";")}\n${sample.join(";")}\n`;
}
