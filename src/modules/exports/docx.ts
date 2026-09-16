import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  Header,
  Footer,
  PageNumber,
  AlignmentType,
} from "docx";
import type { ExportDocumentModel } from "./sanitize";
import { sanitizeSpreadsheetText } from "./sanitize";

function cell(text: string, bold = false) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text: sanitizeSpreadsheetText(text), bold, size: 18 })],
      }),
    ],
  });
}

export async function renderDocx(model: ExportDocumentModel): Promise<Buffer> {
  const headerRow = new TableRow({
    children: [
      cell("Раздел", true),
      cell("Позиция", true),
      cell("Ед.", true),
      cell("Кол-во", true),
      cell("Цена", true),
      cell("Скидка", true),
      cell("Сумма", true),
      ...(model.variant === "internal" ? [cell("Закупка", true)] : []),
    ],
    tableHeader: true,
  });

  const bodyRows = model.rows.map(
    (r) =>
      new TableRow({
        children: [
          cell(r.sectionTitle),
          cell(r.name),
          cell(r.unit),
          cell(r.qty),
          cell(r.unitPrice ?? "по запросу"),
          cell(r.discount ?? "—"),
          cell(r.lineNet ?? "—"),
          ...(model.variant === "internal"
            ? [cell(r.purchasePrice ?? "—")]
            : []),
        ],
      }),
  );

  const children: Paragraph[] = [
    new Paragraph({
      text: model.documentType,
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${model.title} · ${model.number} · ${model.versionLabel}`,
          bold: true,
        }),
      ],
    }),
    new Paragraph({
      text: `Дата: ${model.issuedAt} · ${model.city ?? ""} · ${model.objectName ?? ""}`,
    }),
    new Paragraph({
      text: `Заказчик: ${model.clientName ?? "—"} · Составитель: ${model.composerName ?? "—"}`,
    }),
  ];

  if (model.preliminary) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "ПРЕДВАРИТЕЛЬНЫЙ РАСЧЁТ — не фиксированная версия",
            bold: true,
            color: "B42318",
          }),
        ],
      }),
    );
  }
  if (model.internalNote) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: model.internalNote, bold: true })],
      }),
    );
  }

  children.push(
    new Paragraph({ text: "" }),
    new Paragraph({ text: "Позиции", heading: HeadingLevel.HEADING_2 }),
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                text: `QuatHub · ${model.number} ${model.versionLabel}`,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Стр. " }),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                  new TextRun({ text: " · Коммерческий расчёт, не ПСД" }),
                ],
              }),
            ],
          }),
        },
        children: [
          ...children,
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...bodyRows],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            text: model.totals.complete
              ? `Итого: ${model.totals.grandTotal} ${model.currency}`
              : `Известная часть стоимости: ${model.totals.knownSubtotal} ${model.currency}`,
          }),
          new Paragraph({
            text: `Строки без НДС: ${model.totals.linesExVat}; начисления: ${model.totals.adjustmentsExVat}; НДС: ${model.totals.outputVatTotal}`,
          }),
          new Paragraph({
            text: `Политика: ${model.policyVersion}`,
          }),
          ...(model.unknownLines.length
            ? [
                new Paragraph({ text: "Неуточнённые позиции:", heading: HeadingLevel.HEADING_2 }),
                ...model.unknownLines.map(
                  (u) =>
                    new Paragraph({
                      text: `• ${u.name}${u.reason ? ` — ${u.reason}` : ""}`,
                    }),
                ),
              ]
            : []),
          new Paragraph({ text: "Условия", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: model.terms ?? "—" }),
          new Paragraph({ text: "Исключения", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: model.exclusions ?? "—" }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "Подпись заказчика _____________ / дата ______" }),
          new Paragraph({ text: "Подпись исполнителя _____________ / дата ______" }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Места подписей пустые. Поддельные печати запрещены.",
                italics: true,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
