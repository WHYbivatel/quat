import { chromium } from "playwright";
import type { ExportDocumentModel } from "./sanitize";
import { sanitizeSpreadsheetText } from "./sanitize";

function esc(s: string): string {
  return sanitizeSpreadsheetText(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildPdfHtml(model: ExportDocumentModel): string {
  const rows = model.rows
    .map(
      (r) => `
      <tr>
        <td>${esc(r.sectionTitle)}</td>
        <td>${esc(r.name)}</td>
        <td>${esc(r.unit)}</td>
        <td class="num">${esc(r.qty)}</td>
        <td class="num">${esc(r.unitPrice ?? "по запросу")}</td>
        <td class="num">${esc(r.discount ?? "—")}</td>
        <td class="num">${esc(r.lineNet ?? "—")}</td>
        ${
          model.variant === "internal"
            ? `<td class="num">${esc(r.purchasePrice ?? "—")}</td>`
            : ""
        }
      </tr>`,
    )
    .join("");

  const unknown = model.unknownLines
    .map((u) => `<li>${esc(u.name)}${u.reason ? ` — ${esc(u.reason)}` : ""}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>${esc(model.title)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm 18mm 14mm; }
  body {
    font-family: "DejaVu Sans", "Noto Sans", "Arial Unicode MS", "Segoe UI", sans-serif;
    font-size: 10.5pt;
    color: #1c2421;
    line-height: 1.35;
  }
  h1 { font-size: 16pt; margin: 0 0 6pt; }
  h2 { font-size: 12pt; margin: 14pt 0 6pt; }
  .meta { color: #5a6b64; font-size: 9.5pt; margin-bottom: 8pt; }
  .banner {
    border: 1px solid #b42318;
    color: #b42318;
    padding: 6pt 8pt;
    margin: 8pt 0;
    font-weight: 600;
  }
  table { width: 100%; border-collapse: collapse; margin-top: 8pt; }
  th, td {
    border-bottom: 1px solid #d5e0db;
    padding: 4pt 3pt;
    vertical-align: top;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  th {
    text-align: left;
    font-size: 9pt;
    color: #5a6b64;
    background: #f3f6f4;
  }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  .num { text-align: right; white-space: nowrap; }
  .totals { margin-top: 12pt; }
  .sign { margin-top: 24pt; font-size: 9.5pt; }
  .footer-note { margin-top: 10pt; font-size: 8.5pt; color: #5a6b64; }
</style>
</head>
<body>
  <h1>${esc(model.documentType)}</h1>
  <div class="meta">
    <div><strong>${esc(model.title)}</strong> · ${esc(model.number)} · ${esc(model.versionLabel)}</div>
    <div>Дата: ${esc(model.issuedAt)}</div>
    <div>Город: ${esc(model.city ?? "—")} · Объект: ${esc(model.objectName ?? "—")}</div>
    <div>Заказчик: ${esc(model.clientName ?? "—")} · Составитель: ${esc(model.composerName ?? "—")}</div>
    <div>Валюта: ${esc(model.currency)} · Политика: ${esc(model.policyVersion)}</div>
  </div>
  ${model.preliminary ? `<div class="banner">ПРЕДВАРИТЕЛЬНЫЙ РАСЧЁТ</div>` : ""}
  ${model.internalNote ? `<div class="banner">${esc(model.internalNote)}</div>` : ""}

  <table>
    <thead>
      <tr>
        <th>Раздел</th>
        <th>Позиция</th>
        <th>Ед.</th>
        <th class="num">Кол-во</th>
        <th class="num">Цена</th>
        <th class="num">Скидка</th>
        <th class="num">Сумма</th>
        ${model.variant === "internal" ? "<th class=\"num\">Закупка</th>" : ""}
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="totals">
    ${
      model.totals.complete && model.totals.grandTotal
        ? `<p><strong>Итого: ${esc(model.totals.grandTotal)} ${esc(model.currency)}</strong></p>`
        : `<p><strong>Известная часть стоимости: ${esc(model.totals.knownSubtotal)} ${esc(model.currency)}</strong></p>`
    }
    <p>Строки без НДС: ${esc(model.totals.linesExVat)} · Начисления: ${esc(model.totals.adjustmentsExVat)} · Выходной НДС: ${esc(model.totals.outputVatTotal)}</p>
  </div>

  ${
    unknown
      ? `<h2>Неуточнённые позиции</h2><ul>${unknown}</ul>`
      : ""
  }

  <h2>Условия</h2>
  <p>${esc(model.terms ?? "—")}</p>
  <h2>Исключения</h2>
  <p>${esc(model.exclusions ?? "—")}</p>
  <h2>Допущения</h2>
  <p>${esc(model.assumptions ?? "—")}</p>

  <div class="sign">
    <p>Подпись заказчика: _________________ / дата ______</p>
    <p>Подпись исполнителя: _________________ / дата ______</p>
    <p>Места подписей пустые. Поддельные печати и подписи запрещены.</p>
  </div>
  <p class="footer-note">Коммерческий расчёт QuatHub. Не является нормативной ПСД. Страницы нумеруются при печати PDF.</p>
</body>
</html>`;
}

export async function renderPdf(model: ExportDocumentModel): Promise<Buffer> {
  const html = buildPdfHtml(model);
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    // Local content only — no network navigation to arbitrary URLs
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:8px;width:100%;padding:0 14mm;color:#5a6b64;">QuatHub</div>`,
      footerTemplate: `<div style="font-size:8px;width:100%;padding:0 14mm;color:#5a6b64;display:flex;justify-content:space-between;"><span>Коммерческий расчёт</span><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>`,
      margin: { top: "18mm", bottom: "18mm", left: "14mm", right: "14mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
