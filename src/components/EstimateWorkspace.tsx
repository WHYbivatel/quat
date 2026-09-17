"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import {
  Button,
  Dialog,
  EmptyState,
  EstimateLine,
  Field,
  InlineFeedback,
  Input,
  Menu,
  MenuItem,
  QuantityStepper,
  Summary,
  Textarea,
} from "@/components/ui";

type Line = {
  id: string;
  sectionId: string | null;
  nameSnapshot: string;
  unitSnapshot: string;
  qty: string;
  unitSalePrice: string | null;
  unitPurchasePrice: string | null;
  discountPercent: string | null;
  unknownPriceReason: string | null;
  supplierNameSnapshot: string | null;
  costType: string;
  priceType: string | null;
  offerId: string | null;
};

type Section = { id: string; title: string };
type Adjustment = { id: string; name: string; type: string; value: string };
type Version = {
  id: string;
  versionNumber: number;
  issuedAt: string;
  documentKind: string;
};
type CatalogHit = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  kind: string;
};
type PriceDiff = {
  lineId: string;
  name: string;
  oldPrice: string | null;
  newPrice: string | null;
  changed: boolean;
  offerGone: boolean;
};
type Warning = { lineId: string; message: string };

type ActionResult =
  | {
      ok: true;
      revision: number;
      href?: string;
      versionId?: string;
      versionNumber?: number;
      token?: string;
    }
  | { ok: false; error: string; conflict?: boolean };

type PdfFeedback =
  | { kind: "idle" }
  | { kind: "working"; label: string }
  | { kind: "success"; label: string }
  | { kind: "error"; label: string; requestId?: string; detail?: string };

type IssueFeedback =
  | { kind: "idle" }
  | { kind: "working" }
  | {
      kind: "success";
      versionId: string;
      versionNumber: number;
      href: string;
    }
  | { kind: "error"; label: string };

type Props = {
  projectId: string;
  estimateId: string;
  draftRevision: number;
  estimateTitle: string;
  projectName: string;
  objectName: string | null;
  clientName: string | null;
  assumptions: string | null;
  terms: string | null;
  exclusions: string | null;
  proposalStatus: string;
  sections: Section[];
  lines: Line[];
  adjustments: Adjustment[];
  versions: Version[];
  warnings: Warning[];
  knownSubtotal: string;
  unknownCount: number;
  complete: boolean;
  grandTotal: string | null;
  outputVatTotal: string;
  policyVersion: string;
  blockedForFixed: boolean;
  catalogHits: CatalogHit[];
  view: "internal" | "client";
  actions: {
    updateQty: (fd: FormData) => Promise<ActionResult>;
    removeLine: (fd: FormData) => Promise<ActionResult>;
    saveLine: (fd: FormData) => Promise<ActionResult>;
    addManual: (fd: FormData) => Promise<ActionResult>;
    addAdjustment: (fd: FormData) => Promise<ActionResult>;
    duplicateSection: (fd: FormData) => Promise<ActionResult>;
    duplicateEstimate: (fd: FormData) => Promise<ActionResult>;
    saveMeta: (fd: FormData) => Promise<ActionResult>;
    issueVersion: (fd: FormData) => Promise<ActionResult>;
    comparePrices: (estimateId: string) => Promise<PriceDiff[]>;
    applyPrices: (fd: FormData) => Promise<ActionResult>;
    createPublicLink: (fd: FormData) => Promise<ActionResult>;
  };
};

const UNIT_LABEL: Record<string, string> = {
  pcs: "шт.",
  m: "м",
  m2: "м²",
  kg: "кг",
  set: "компл.",
  point: "точка",
  visit: "выезд",
  hour: "час",
  contour: "контур",
  cable_line: "каб. линия",
};

function unitLabel(code: string) {
  return UNIT_LABEL[code] ?? code;
}

function hasIndividualTerms(line: Line) {
  if (line.discountPercent && line.discountPercent !== "0") return true;
  if (!line.offerId) return true;
  return false;
}

function lineTotal(line: Line): number | null {
  if (line.unitSalePrice == null || line.unknownPriceReason) return null;
  const qty = Number(line.qty);
  const price = Number(line.unitSalePrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return null;
  let total = qty * price;
  const disc = line.discountPercent ? Number(line.discountPercent) : 0;
  if (Number.isFinite(disc) && disc > 0) total *= 1 - disc / 100;
  return total;
}

function versionLabel(v: Version) {
  const date = new Date(v.issuedAt).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Версия №${v.versionNumber} · ${date}`;
}

function DownloadMenu({
  label,
  disabled,
  onSelect,
}: {
  label: ReactNode;
  disabled?: boolean;
  onSelect: (format: "pdf" | "xlsx" | "docx" | "csv") => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={root}>
      <Button
        variant="primary"
        className="w-full"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onBlur={(e) => {
          if (!root.current?.contains(e.relatedTarget as Node)) setOpen(false);
        }}
      >
        {label}
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute z-50 mt-1 w-full min-w-[200px] rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--control)] p-1 shadow-lg"
        >
          {(["pdf", "xlsx", "docx", "csv"] as const).map((format) => (
            <MenuItem
              key={format}
              onClick={() => {
                setOpen(false);
                onSelect(format);
              }}
            >
              {format.toUpperCase()}
              {format === "pdf" ? " · предварительный" : ""}
            </MenuItem>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function EstimateWorkspace(props: Props) {
  const router = useRouter();
  const [view, setView] = useState<"internal" | "client">(props.view);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [issueFeedback, setIssueFeedback] = useState<IssueFeedback>({ kind: "idle" });
  const [pdfFeedback, setPdfFeedback] = useState<PdfFeedback>({ kind: "idle" });
  const [pending, startTransition] = useTransition();
  const [priceDiffs, setPriceDiffs] = useState<PriceDiff[] | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [clientRevision, setClientRevision] = useState(props.draftRevision);
  const revision = Math.max(props.draftRevision, clientRevision);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfFallbackUrl, setPdfFallbackUrl] = useState<string | null>(null);
  const [pdfUnavailable, setPdfUnavailable] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [sumDetailsOpen, setSumDetailsOpen] = useState(false);
  const pdfStatusId = "preview-pdf-status";
  const issueStatusId = "issue-version-status";

  const lineCount = props.lines.length;

  const saveStatusLabel = useMemo(() => {
    if (saveState === "saving" || pending) return "Сохраняется…";
    if (saveState === "saved") return "Сохранено";
    if (saveState === "error") return "Ошибка";
    return null;
  }, [saveState, pending]);

  function run(
    fn: () => Promise<ActionResult>,
    opts?: { reload?: boolean; kind?: "save" | "issue" },
  ) {
    const kind = opts?.kind ?? "save";
    if (kind === "issue") {
      setIssueFeedback({ kind: "working" });
    } else {
      setSaveState("saving");
      setSaveMessage(null);
    }
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        if (kind === "issue") {
          setIssueFeedback({
            kind: "error",
            label: res.conflict
              ? res.error ||
                "На сервере есть более новая редакция сметы. Обновите страницу и повторите."
              : res.error,
          });
        } else {
          setSaveState("error");
          setSaveMessage(
            res.conflict
              ? res.error ||
                  "На сервере есть более новая редакция сметы. Обновите страницу и повторите."
              : res.error,
          );
        }
        return;
      }
      if (typeof res.revision === "number" && res.revision > 0) {
        setClientRevision(res.revision);
      }
      if (kind === "issue" && res.versionId && res.href) {
        setIssueFeedback({
          kind: "success",
          versionId: res.versionId,
          versionNumber: res.versionNumber ?? 0,
          href: res.href,
        });
        setSaveState("saved");
      } else {
        setSaveState("saved");
      }
      if (res.token) {
        setPublicUrl(`${window.location.origin}/p/${res.token}`);
      }
      if (res.href && !res.versionId) {
        router.push(res.href);
        return;
      }
      if (opts?.reload !== false) {
        router.refresh();
      }
    });
  }

  async function downloadDraft(format: "pdf" | "xlsx" | "docx" | "csv") {
    if (pdfBusy) return;
    if (format === "pdf" && pdfUnavailable) return;
    setPdfBusy(true);
    setPdfFeedback({
      kind: "working",
      label: format === "pdf" ? "Подготавливаем PDF…" : `Подготавливаем ${format.toUpperCase()}…`,
    });
    if (format === "pdf" && pdfFallbackUrl) {
      URL.revokeObjectURL(pdfFallbackUrl);
      setPdfFallbackUrl(null);
    }
    try {
      const res = await fetch("/api/exports/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateId: props.estimateId,
          expectedRevision: revision,
          format,
          variant: view === "internal" ? "internal" : "client",
        }),
      });
      const ctype = res.headers.get("content-type") || "";
      const requestId = res.headers.get("x-request-id") || undefined;
      if (!res.ok) {
        let error =
          format === "pdf"
            ? "Не удалось подготовить PDF. Повторите."
            : "Не удалось подготовить документ.";
        let detail: string | undefined;
        let bodyRequestId = requestId;
        if (ctype.includes("application/json")) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
            requestId?: string;
          };
          if (body.error) error = body.error;
          bodyRequestId = body.requestId || requestId;
          if (res.status === 503) {
            setPdfUnavailable(true);
            detail = "Генератор PDF недоступен на этом стенде.";
          }
        } else {
          error = `Ошибка экспорта (${res.status}). Повторите.`;
        }
        setPdfFeedback({
          kind: "error",
          label:
            error === "Export failed"
              ? "Не удалось подготовить PDF. Повторите."
              : error,
          requestId: bodyRequestId,
          detail,
        });
        return;
      }
      if (format === "pdf" && !ctype.includes("application/pdf")) {
        setPdfFeedback({
          kind: "error",
          label: "Сервер вернул не PDF. Повторите.",
          requestId,
        });
        return;
      }
      const blob = await res.blob();
      if (format === "pdf") {
        if (blob.size < 5 || !(await blob.slice(0, 4).text()).startsWith("%PDF")) {
          setPdfFeedback({
            kind: "error",
            label: "Получен повреждённый PDF. Повторите.",
            requestId,
          });
          return;
        }
      }
      const url = URL.createObjectURL(blob);
      if (format === "pdf") setPdfFallbackUrl(url);
      const a = document.createElement("a");
      a.href = url;
      a.download = `estimate-draft-r${revision}.${format}`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (format !== "pdf") URL.revokeObjectURL(url);
      setPdfFeedback({
        kind: "success",
        label: format === "pdf" ? "PDF готов" : `${format.toUpperCase()} готов`,
      });
    } catch {
      setPdfFeedback({
        kind: "error",
        label:
          format === "pdf"
            ? "Не удалось подготовить PDF. Повторите."
            : "Не удалось подготовить документ.",
      });
    } finally {
      setPdfBusy(false);
    }
  }

  function handleQtyChange(lineId: string, qty: number) {
    const fd = new FormData();
    fd.set("lineId", lineId);
    fd.set("qty", String(qty));
    fd.set("expectedRevision", String(revision));
    run(() => props.actions.updateQty(fd));
  }

  function handleRemoveLine(lineId: string) {
    const fd = new FormData();
    fd.set("lineId", lineId);
    fd.set("expectedRevision", String(revision));
    run(() => props.actions.removeLine(fd));
  }

  function handleIssueVersion(preliminary = false) {
    const fd = new FormData();
    fd.set("estimateId", props.estimateId);
    fd.set("expectedRevision", String(revision));
    if (preliminary) {
      fd.set("allowPreliminary", "1");
      fd.set("idempotencyKey", `issue:${props.estimateId}:r${revision}:1`);
    } else {
      fd.set("idempotencyKey", `issue:${props.estimateId}:r${revision}:0`);
    }
    run(() => props.actions.issueVersion(fd), { kind: "issue" });
  }

  const summaryPanel = (
    <div className="flex flex-col gap-3">
      <Summary
        total={props.complete && props.grandTotal ? props.grandTotal : props.knownSubtotal}
        complete={props.complete}
        knownLabel={
          props.unknownCount > 0
            ? `Известная часть · без цены: ${props.unknownCount}`
            : "Известная часть стоимости"
        }
      >
        {!props.complete && props.unknownCount > 0 ? (
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Незаполненных позиций: {props.unknownCount}
          </p>
        ) : null}

        {(props.outputVatTotal !== "0" && props.outputVatTotal !== "0.00") ||
        props.adjustments.length > 0 ? (
          <div className="mt-2">
            <button
              type="button"
              className="text-xs text-[var(--text-secondary)] underline"
              aria-expanded={sumDetailsOpen}
              onClick={() => setSumDetailsOpen((v) => !v)}
            >
              Что входит в сумму
            </button>
            {sumDetailsOpen ? (
              <ul className="mt-1 space-y-0.5 text-xs text-[var(--text-secondary)]">
                {props.outputVatTotal !== "0" && props.outputVatTotal !== "0.00" ? (
                  <li>НДС выходной: {props.outputVatTotal} ₸</li>
                ) : null}
                {props.adjustments.length > 0 ? (
                  <li>
                    Начислений: {props.adjustments.length}
                    {props.adjustments.map((a) => (
                      <span key={a.id} className="block pl-2">
                        {a.name}: {a.type} {a.value}
                      </span>
                    ))}
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : null}
      </Summary>

      <DownloadMenu
        label={
          pdfBusy && pdfFeedback.kind === "working"
            ? pdfFeedback.label
            : "Скачать смету ▾"
        }
        disabled={pdfBusy || (pdfUnavailable && pdfFeedback.kind !== "working")}
        onSelect={(format) => {
          void downloadDraft(format);
        }}
      />

      <div id={pdfStatusId} className="space-y-1" aria-live="polite">
        {pdfFeedback.kind === "working" ? (
          <p className="text-xs text-[var(--text-secondary)]">{pdfFeedback.label}</p>
        ) : null}
        {pdfFeedback.kind === "success" ? (
          <p className="text-xs text-[var(--text-secondary)]">{pdfFeedback.label}</p>
        ) : null}
        {pdfFeedback.kind === "error" ? (
          <InlineFeedback tone="error">
            <span>{pdfFeedback.label}</span>
            {pdfFeedback.requestId ? (
              <span className="mt-1 block text-[10px] opacity-80">
                Код обращения: {pdfFeedback.requestId}
              </span>
            ) : null}
            {pdfFeedback.detail ? (
              <span className="mt-1 block text-[10px] opacity-80">{pdfFeedback.detail}</span>
            ) : null}
            {!pdfUnavailable ? (
              <button
                type="button"
                className="mt-2 text-xs font-semibold underline"
                onClick={() => {
                  void downloadDraft("pdf");
                }}
              >
                Повторить
              </button>
            ) : null}
          </InlineFeedback>
        ) : null}
        {pdfFallbackUrl ? (
          <a
            href={pdfFallbackUrl}
            download={`estimate-draft-r${revision}.pdf`}
            className="block text-sm text-[var(--text-secondary)] underline"
          >
            Скачать ещё раз
          </a>
        ) : null}
      </div>

      {saveStatusLabel ? (
        <p className="text-xs text-[var(--text-secondary)]" aria-live="polite">
          {saveStatusLabel}
        </p>
      ) : null}

      <div id={issueStatusId} aria-live="polite">
        {issueFeedback.kind === "working" ? (
          <p className="text-xs text-[var(--text-secondary)]">Фиксируем версию…</p>
        ) : null}
        {issueFeedback.kind === "error" ? (
          <InlineFeedback tone="error">{issueFeedback.label}</InlineFeedback>
        ) : null}
        {issueFeedback.kind === "success" ? (
          <InlineFeedback tone="success">
            <span>Версия №{issueFeedback.versionNumber || "?"} создана.</span>
            <Link
              href={issueFeedback.href}
              className="mt-1 block font-semibold underline"
            >
              Открыть версию №{issueFeedback.versionNumber || ""}
            </Link>
          </InlineFeedback>
        ) : null}
      </div>

      {priceDiffs ? (
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] p-3 text-xs">
          <p className="font-semibold">Сравнение цен</p>
          {priceDiffs.length === 0 ? (
            <p className="mt-1 text-[var(--text-secondary)]">Изменений нет</p>
          ) : (
            <>
              <ul className="mt-1 space-y-1">
                {priceDiffs.map((d) => (
                  <li key={d.lineId}>
                    {d.name}: {d.oldPrice ?? "—"} → {d.offerGone ? "нет" : d.newPrice ?? "—"}
                  </li>
                ))}
              </ul>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() => {
                  const fd = new FormData();
                  fd.set("estimateId", props.estimateId);
                  fd.set("expectedRevision", String(revision));
                  fd.set("lineIds", priceDiffs.map((d) => d.lineId).join(","));
                  run(() => props.actions.applyPrices(fd));
                  setPriceDiffs(null);
                }}
              >
                Применить
              </Button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-[var(--border)] bg-[var(--page)] px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">
                {props.estimateTitle}
              </h1>
              {saveStatusLabel ? (
                <span className="text-xs text-[var(--text-secondary)]" aria-live="polite">
                  {saveStatusLabel}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/app/projects"
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Мои сметы
            </Link>
            <Menu label="⋯" align="right">
              <MenuItem
                disabled={props.blockedForFixed || issueFeedback.kind === "working"}
                onClick={() => handleIssueVersion(false)}
              >
                Зафиксировать версию
              </MenuItem>
              {props.blockedForFixed ? (
                <MenuItem
                  disabled={issueFeedback.kind === "working"}
                  onClick={() => handleIssueVersion(true)}
                >
                  Предварительная версия
                </MenuItem>
              ) : null}
              <MenuItem onClick={() => setVersionsOpen(true)}>История версий</MenuItem>
              <MenuItem onClick={() => setMetaOpen(true)}>Данные для документа</MenuItem>
              <MenuItem
                onClick={() => {
                  startTransition(async () => {
                    const diffs = await props.actions.comparePrices(props.estimateId);
                    setPriceDiffs(diffs.filter((d) => d.changed || d.offerGone));
                  });
                }}
              >
                Обновить цены…
              </MenuItem>
              <MenuItem
                onClick={() => setView(view === "client" ? "internal" : "client")}
              >
                {view === "client" ? "Внутренний вид" : "Клиентский вид"}
              </MenuItem>
            </Menu>
          </div>
        </div>

        {saveMessage ? (
          <InlineFeedback tone={saveState === "error" ? "error" : "warning"} className="mt-2">
            {saveMessage}
          </InlineFeedback>
        ) : null}

        {props.warnings.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {props.warnings.map((w) => (
              <li key={w.lineId + w.message}>
                <InlineFeedback tone="warning">{w.message}</InlineFeedback>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className="mx-auto flex w-full flex-1 flex-col gap-4 px-5 py-4 lg:flex-row lg:items-start">
        <section className="min-w-0 flex-1 lg:max-w-[calc(100%-380px)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-[var(--text-secondary)]">
              {lineCount > 0 ? `${lineCount} поз.` : "Смета пуста"}
            </p>
            <Link
              href={`/catalog/products?projectId=${props.projectId}`}
              className="text-sm font-medium text-[var(--text-primary)] underline"
            >
              + Добавить из каталога
            </Link>
          </div>

          {lineCount === 0 ? (
            <EmptyState
              title="Добавьте товары или услуги из каталога"
              action={
                <Link
                  href={`/catalog/products?projectId=${props.projectId}`}
                  className="inline-flex min-h-9 items-center rounded-[var(--radius-button)] bg-[var(--brand)] px-3 text-sm font-semibold text-[var(--brand-foreground)]"
                >
                  Перейти в каталог
                </Link>
              }
            />
          ) : (
            <div className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--panel)] px-3">
              {props.sections.map((section) => {
                const sectionLines = props.lines.filter((l) => l.sectionId === section.id);
                if (sectionLines.length === 0) return null;
                return (
                  <div key={section.id} className="py-2">
                    {props.sections.length > 1 ? (
                      <h2 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        {section.title}
                      </h2>
                    ) : null}
                    {sectionLines.map((line) => {
                      const unknown = line.unitSalePrice == null || !!line.unknownPriceReason;
                      const total = lineTotal(line);
                      return (
                        <EstimateLine
                          key={line.id}
                          name={line.nameSnapshot}
                          unitPrice={line.unitSalePrice}
                          unit={unitLabel(line.unitSnapshot)}
                          lineTotal={total}
                          unknownPrice={unknown}
                          individualTerms={hasIndividualTerms(line)}
                          onRemove={() => handleRemoveLine(line.id)}
                          stepper={
                            <QuantityStepper
                              value={Number(line.qty) || 1}
                              min={1}
                              pending={pending}
                              onChange={(n) => handleQtyChange(line.id, n)}
                              label={`Количество ${line.nameSnapshot}`}
                              presets={
                                line.unitSnapshot === "m" || line.unitSnapshot === "pcs"
                                  ? [10, 100]
                                  : undefined
                              }
                            />
                          }
                        />
                      );
                    })}
                  </div>
                );
              })}
              {props.lines.some((l) => !l.sectionId) ? (
                <div className="py-2">
                  {props.lines
                    .filter((l) => !l.sectionId)
                    .map((line) => {
                      const unknown = line.unitSalePrice == null || !!line.unknownPriceReason;
                      const total = lineTotal(line);
                      return (
                        <EstimateLine
                          key={line.id}
                          name={line.nameSnapshot}
                          unitPrice={line.unitSalePrice}
                          unit={unitLabel(line.unitSnapshot)}
                          lineTotal={total}
                          unknownPrice={unknown}
                          individualTerms={hasIndividualTerms(line)}
                          onRemove={() => handleRemoveLine(line.id)}
                          stepper={
                            <QuantityStepper
                              value={Number(line.qty) || 1}
                              min={1}
                              pending={pending}
                              onChange={(n) => handleQtyChange(line.id, n)}
                              label={`Количество ${line.nameSnapshot}`}
                              presets={
                                line.unitSnapshot === "m" || line.unitSnapshot === "pcs"
                                  ? [10, 100]
                                  : undefined
                              }
                            />
                          }
                        />
                      );
                    })}
                </div>
              ) : null}
            </div>
          )}
        </section>

        <aside className="w-full shrink-0 lg:sticky lg:top-4 lg:w-[360px]">
          <div className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--panel)] p-4">
            {summaryPanel}
          </div>
        </aside>
      </div>

      <Dialog open={metaOpen} onClose={() => setMetaOpen(false)} title="Данные для документа">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("projectId", props.projectId);
            fd.set("estimateId", props.estimateId);
            fd.set("expectedRevision", String(revision));
            run(() => props.actions.saveMeta(fd), {
              reload: true,
            });
            setMetaOpen(false);
          }}
        >
          <Field label="Название сметы">
            <Input name="title" defaultValue={props.estimateTitle} />
          </Field>
          <Field label="Проект">
            <Input name="projectName" defaultValue={props.projectName} />
          </Field>
          <Field label="Объект" optional>
            <Input name="objectName" defaultValue={props.objectName ?? ""} />
          </Field>
          <Field label="Заказчик" optional>
            <Input name="clientName" defaultValue={props.clientName ?? ""} />
          </Field>
          <Field label="Условия" optional>
            <Textarea name="terms" defaultValue={props.terms ?? ""} rows={2} />
          </Field>
          <Field label="Допущения" optional>
            <Textarea name="assumptions" defaultValue={props.assumptions ?? ""} rows={2} />
          </Field>
          <input type="hidden" name="exclusions" value={props.exclusions ?? ""} />
          <input type="hidden" name="proposalStatus" value={props.proposalStatus} />
          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="primary" pending={pending}>
              Сохранить
            </Button>
            <Button type="button" variant="secondary" onClick={() => setMetaOpen(false)}>
              Отмена
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={versionsOpen} onClose={() => setVersionsOpen(false)} title="История версий">
        {props.versions.length === 0 ? (
          <EmptyState title="Пока нет зафиксированных версий" className="border-0 bg-transparent px-0" />
        ) : (
          <ul className="space-y-2">
            {props.versions.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-input)] border border-[var(--border)] px-3 py-2 text-sm"
              >
                <span>{versionLabel(v)}</span>
                <div className="flex gap-2">
                  <Link
                    href={`/app/versions/${v.id}`}
                    className="text-[var(--text-primary)] underline"
                  >
                    Открыть
                  </Link>
                  <button
                    type="button"
                    className="text-[var(--text-secondary)] underline"
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("versionId", v.id);
                      fd.set("expiresInDays", "30");
                      run(() => props.actions.createPublicLink(fd), { reload: false });
                    }}
                  >
                    Ссылка
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {publicUrl ? (
          <p className="mt-3 break-all text-xs text-[var(--text-secondary)]">{publicUrl}</p>
        ) : null}
      </Dialog>
    </div>
  );
}
