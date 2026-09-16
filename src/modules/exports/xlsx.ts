import ExcelJS from "exceljs";
import type { ExportDocumentModel } from "./sanitize";
import { sanitizeSpreadsheetText } from "./sanitize";

export async function renderXlsx(model: ExportDocumentModel): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "QuatHub";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Смета", {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true },
  });

  const headers = [
    "Раздел",
    "Позиция",
    "Ед.",
    "Кол-во",
    "Цена",
    "Скидка",
    "Сумма без НДС",
    "НДС",
    ...(model.variant === "internal" ? ["Закупка", "Поставщик", "Заметка внутр."] : []),
  ];
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };

  for (const r of model.rows) {
    const row = [
      sanitizeSpreadsheetText(r.sectionTitle),
      sanitizeSpreadsheetText(r.name),
      sanitizeSpreadsheetText(r.unit),
      Number(r.qty),
      r.unitPrice != null ? Number(r.unitPrice) : null,
      sanitizeSpreadsheetText(r.discount ?? ""),
      r.lineNet != null ? Number(r.lineNet) : null,
      r.outputVat != null ? Number(r.outputVat) : null,
    ];
    if (model.variant === "internal") {
      row.push(
        r.purchasePrice != null ? Number(r.purchasePrice) : null,
        sanitizeSpreadsheetText(r.supplier ?? ""),
        sanitizeSpreadsheetText(r.notesInternal ?? ""),
      );
    }
    sheet.addRow(row);
  }

  // Number formats for money columns
  for (let i = 2; i <= sheet.rowCount; i++) {
    for (const col of [4, 5, 7, 8]) {
      const cell = sheet.getRow(i).getCell(col);
      if (typeof cell.value === "number") {
        cell.numFmt = '#,##0.00" KZT"';
      }
    }
    if (model.variant === "internal") {
      const purchase = sheet.getRow(i).getCell(9);
      if (typeof purchase.value === "number") {
        purchase.numFmt = '#,##0.00" KZT"';
      }
    }
  }

  const resources = wb.addWorksheet("Ресурсы");
  resources.addRow(["Тип", "Название", "Сумма", "НДС"]);
  resources.getRow(1).font = { bold: true };
  for (const a of model.adjustments) {
    resources.addRow([
      "начисление",
      sanitizeSpreadsheetText(a.name),
      Number(a.amount),
      a.vat != null ? Number(a.vat) : null,
    ]);
  }
  resources.addRow([]);
  resources.addRow(["Итог строки без НДС", "", Number(model.totals.linesExVat)]);
  resources.addRow(["Начисления без НДС", "", Number(model.totals.adjustmentsExVat)]);
  resources.addRow(["Выходной НДС", "", Number(model.totals.outputVatTotal)]);
  resources.addRow([
    model.totals.complete ? "Итого" : "Известная часть",
    "",
    Number(model.totals.grandTotal ?? model.totals.knownSubtotal),
  ]);

  const terms = wb.addWorksheet("Условия");
  terms.addRow(["Поле", "Значение"]);
  terms.getRow(1).font = { bold: true };
  const termRows: [string, string][] = [
    ["Документ", model.documentType],
    ["Номер", model.number],
    ["Версия", model.versionLabel],
    ["Валюта", model.currency],
    ["Политика", model.policyVersion],
    ["Город", model.city ?? ""],
    ["Объект", model.objectName ?? ""],
    ["Заказчик", model.clientName ?? ""],
    ["Срок предложения", model.offerValidUntil ?? ""],
    ["Условия", model.terms ?? ""],
    ["Исключения", model.exclusions ?? ""],
    ["Допущения", model.assumptions ?? ""],
    [
      "Примечание",
      "После ручного изменения ячеек файл больше не является неизменённой выгрузкой версии. Формулы Excel в MVP не используются — значения с сервера.",
    ],
  ];
  if (model.internalNote) {
    termRows.push(["Внимание", model.internalNote]);
  }
  if (model.preliminary) {
    termRows.push(["Статус", "Предварительный расчёт"]);
  }
  for (const [k, v] of termRows) {
    terms.addRow([sanitizeSpreadsheetText(k), sanitizeSpreadsheetText(v)]);
  }
  if (model.unknownLines.length) {
    terms.addRow([]);
    terms.addRow(["Неуточнённые позиции"]);
    for (const u of model.unknownLines) {
      terms.addRow([
        sanitizeSpreadsheetText(u.name),
        sanitizeSpreadsheetText(u.reason ?? ""),
      ]);
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
