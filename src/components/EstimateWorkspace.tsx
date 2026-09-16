"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

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

export function EstimateWorkspace(props: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"catalog" | "estimate" | "total">("estimate");
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
  const pdfStatusId = "preview-pdf-status";
  const issueStatusId = "issue-version-status";

  const tabs = useMemo(
    () =>
      [
        { id: "catalog" as const, label: "Каталог" },
        { id: "estimate" as const, label: "Смета" },
        { id: "total" as const, label: "Итог" },
      ] as const,
    [],
  );

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

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--muted)]">
              <Link href="/app/projects">Мои проекты</Link> · {props.projectName}
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-2xl">
              {props.estimateTitle}
            </h1>
            <p className="text-xs text-[var(--muted)]">
              Ревизия черновика: {revision} · политика {props.policyVersion}
              {" · "}
              <span aria-live="polite">
                {saveState === "saving" || pending
                  ? "Сохраняется…"
                  : saveState === "saved"
                    ? "Сохранено"
                    : saveState === "error"
                      ? "Ошибка"
                      : "Готово"}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <button
              type="button"
              className={`rounded-md border px-3 py-1.5 ${view === "client" ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
              onClick={() => setView("client")}
            >
              Клиент
            </button>
            <button
              type="button"
              className={`rounded-md border px-3 py-1.5 ${view === "internal" ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
              onClick={() => setView("internal")}
            >
              Внутренний
            </button>
          </div>
        </div>
        {saveMessage ? (
          <p
            className={`mt-2 text-sm ${saveState === "error" ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}
            role="alert"
          >
            {saveMessage}
          </p>
        ) : null}
        {props.warnings.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm text-[var(--accent-2)]">
            {props.warnings.map((w) => (
              <li key={w.lineId + w.message}>⚠ {w.message}</li>
            ))}
          </ul>
        ) : null}
        {props.lines.length === 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-dashed border-[var(--border)] bg-[var(--bg)] p-4 text-sm">
            <span className="text-[var(--muted)]">Смета пуста.</span>
            <Link
              href={`/catalog/products?projectId=${props.projectId}`}
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 font-semibold text-white"
            >
              Выбрать товары
            </Link>
            <Link
              href={`/catalog/services?projectId=${props.projectId}`}
              className="rounded-md border px-3 py-1.5"
            >
              Выбрать услуги
            </Link>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <Link
              href={`/catalog/products?projectId=${props.projectId}`}
              className="text-[var(--accent)] underline"
            >
              + Добавить товары
            </Link>
            <Link
              href={`/catalog/services?projectId=${props.projectId}`}
              className="text-[var(--accent)] underline"
            >
              + Добавить услуги
            </Link>
          </div>
        )}
      </div>

      <div
        className="flex border-b border-[var(--border)] bg-[var(--surface)] lg:hidden"
        role="tablist"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`flex-1 px-3 py-2 text-sm ${
              tab === t.id
                ? "border-b-2 border-[var(--accent)] font-semibold"
                : "text-[var(--muted)]"
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mx-auto grid w-full max-w-[1400px] flex-1 lg:grid-cols-[260px_1fr_280px]">
        <aside
          className={`border-r border-[var(--border)] bg-[var(--surface)] p-4 ${
            tab === "catalog" ? "block" : "hidden lg:block"
          }`}
        >
          <h2 className="text-sm font-semibold">Каталог</h2>
          <div className="mt-2 flex gap-2 text-sm">
            <Link className="text-[var(--accent)] underline" href="/catalog/products">
              Товары
            </Link>
            <Link className="text-[var(--accent)] underline" href="/catalog/services">
              Услуги
            </Link>
          </div>
          <ul className="mt-4 max-h-[50vh] space-y-2 overflow-auto text-sm">
            {props.catalogHits.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/catalog/items/${c.id}`}
                  className="block rounded-md border border-[var(--border)] p-2 hover:bg-[var(--bg)]"
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {c.sku} · {c.unit}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <form
            className="mt-4 space-y-2 border-t border-[var(--border)] pt-4 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.set("estimateId", props.estimateId);
              fd.set("expectedRevision", String(revision));
              run(() => props.actions.addManual(fd));
            }}
          >
            <h3 className="font-semibold">Ручная строка</h3>
            <label className="block">
              Название
              <input name="name" required className="mt-1 w-full rounded-md border px-2 py-1" />
            </label>
            <div className="flex gap-2">
              <label className="flex-1">
                Ед.
                <input name="unit" defaultValue="pcs" className="mt-1 w-full rounded-md border px-2 py-1" />
              </label>
              <label className="flex-1">
                Кол-во
                <input name="qty" defaultValue="1" className="mt-1 w-full rounded-md border px-2 py-1" />
              </label>
            </div>
            <label className="block">
              Цена продажи (необяз.)
              <input name="unitSalePrice" className="mt-1 w-full rounded-md border px-2 py-1" />
            </label>
            <input type="hidden" name="costType" value="other" />
            <button type="submit" className="w-full rounded-md bg-[var(--accent)] px-3 py-1.5 font-semibold text-white">
              Добавить
            </button>
          </form>
        </aside>

        <section className={`p-4 ${tab === "estimate" ? "block" : "hidden lg:block"}`}>
          <form
            className="mb-4 grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.set("projectId", props.projectId);
              fd.set("estimateId", props.estimateId);
              fd.set("expectedRevision", String(revision));
              run(() => props.actions.saveMeta(fd));
            }}
          >
            <label>
              Название сметы
              <input name="title" defaultValue={props.estimateTitle} className="mt-1 w-full rounded-md border px-2 py-1" />
            </label>
            <label>
              Проект
              <input name="projectName" defaultValue={props.projectName} className="mt-1 w-full rounded-md border px-2 py-1" />
            </label>
            <label>
              Объект
              <input name="objectName" defaultValue={props.objectName ?? ""} className="mt-1 w-full rounded-md border px-2 py-1" />
            </label>
            <label>
              Заказчик
              <input name="clientName" defaultValue={props.clientName ?? ""} className="mt-1 w-full rounded-md border px-2 py-1" />
            </label>
            <label className="md:col-span-2">
              Условия
              <textarea name="terms" defaultValue={props.terms ?? ""} rows={2} className="mt-1 w-full rounded-md border px-2 py-1" />
            </label>
            <label className="md:col-span-2">
              Допущения
              <textarea name="assumptions" defaultValue={props.assumptions ?? ""} rows={2} className="mt-1 w-full rounded-md border px-2 py-1" />
            </label>
            <label>
              Статус предложения
              <select name="proposalStatus" defaultValue={props.proposalStatus} className="mt-1 w-full rounded-md border px-2 py-1">
                <option value="prepared">Подготовлено</option>
                <option value="sent">Отправлено</option>
                <option value="accepted">Принято (не ЭЦП)</option>
                <option value="declined">Отклонено</option>
              </select>
            </label>
            <div className="flex items-end">
              <button type="submit" className="rounded-md border border-[var(--border)] px-3 py-1.5">
                Сохранить реквизиты
              </button>
            </div>
          </form>

          {props.sections.map((section) => (
            <div key={section.id} className="mb-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="font-semibold">{section.title}</h2>
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("sectionId", section.id);
                    fd.set("expectedRevision", String(revision));
                    run(() => props.actions.duplicateSection(fd));
                  }}
                >
                  Дублировать раздел
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-[var(--muted)]">
                      <th className="px-2 py-2">Позиция</th>
                      <th className="px-2 py-2">Кол-во</th>
                      <th className="px-2 py-2">Продажа</th>
                      {view === "internal" ? <th className="px-2 py-2">Закупка</th> : null}
                      <th className="px-2 py-2">Скидка %</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {props.lines
                      .filter((l) => l.sectionId === section.id)
                      .map((line) => (
                        <tr key={line.id} className="border-b align-top">
                          <td className="px-2 py-2">
                            <div className="font-medium">{line.nameSnapshot}</div>
                            <div className="text-xs text-[var(--muted)]">
                              {line.unitSnapshot} · {line.supplierNameSnapshot ?? "—"}
                            </div>
                            {line.unknownPriceReason ? (
                              <div className="text-xs text-[var(--danger)]">{line.unknownPriceReason}</div>
                            ) : null}
                          </td>
                          <td className="px-2 py-2">
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                const fd = new FormData(e.currentTarget);
                                fd.set("lineId", line.id);
                                fd.set("expectedRevision", String(revision));
                                run(() => props.actions.saveLine(fd));
                              }}
                              className="flex flex-col gap-1"
                            >
                              <input
                                name="qty"
                                defaultValue={line.qty}
                                className="w-20 rounded-md border px-1 py-0.5"
                                aria-label="Количество"
                              />
                              <input
                                name="unitSalePrice"
                                defaultValue={line.unitSalePrice ?? ""}
                                className="w-24 rounded-md border px-1 py-0.5"
                                aria-label="Цена продажи"
                                placeholder="цена"
                              />
                              <input
                                name="discountPercent"
                                defaultValue={line.discountPercent ?? ""}
                                className="w-16 rounded-md border px-1 py-0.5"
                                aria-label="Скидка"
                                placeholder="%"
                              />
                              <button type="submit" className="text-xs underline">
                                OK
                              </button>
                            </form>
                          </td>
                          <td className="px-2 py-2">
                            {line.unitSalePrice != null ? `${line.unitSalePrice}` : "по запросу"}
                          </td>
                          {view === "internal" ? (
                            <td className="px-2 py-2 text-[var(--muted)]">
                              {line.unitPurchasePrice ?? "—"}
                            </td>
                          ) : null}
                          <td className="px-2 py-2">{line.discountPercent ?? "—"}</td>
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              className="text-xs text-[var(--danger)] underline"
                              onClick={() => {
                                const fd = new FormData();
                                fd.set("lineId", line.id);
                                fd.set("expectedRevision", String(revision));
                                run(() => props.actions.removeLine(fd));
                              }}
                            >
                              Удалить
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
            <h3 className="font-semibold">Начисления</h3>
            <ul className="mt-2 space-y-1">
              {props.adjustments.map((a) => (
                <li key={a.id}>
                  {a.name}: {a.type} {a.value}
                </li>
              ))}
            </ul>
            <form
              className="mt-3 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                fd.set("estimateId", props.estimateId);
                fd.set("expectedRevision", String(revision));
                run(() => props.actions.addAdjustment(fd));
              }}
            >
              <input name="name" placeholder="Доставка" defaultValue="Доставка" className="rounded-md border px-2 py-1" />
              <select name="type" className="rounded-md border px-2 py-1">
                <option value="amount">сумма</option>
                <option value="percent">%</option>
              </select>
              <input name="value" placeholder="5000" className="w-24 rounded-md border px-2 py-1" required />
              <button type="submit" className="rounded-md bg-[var(--accent)] px-3 py-1 text-white">
                Добавить
              </button>
            </form>
          </div>
        </section>

        <aside
          className={`border-l border-[var(--border)] bg-[var(--surface)] p-4 ${
            tab === "total" ? "block" : "hidden lg:block"
          }`}
        >
          <h2 className="text-sm font-semibold">Итог</h2>
          {props.complete && props.grandTotal ? (
            <>
              <p className="mt-3 text-sm text-[var(--muted)]">Итого</p>
              <p className="text-2xl font-semibold">{props.grandTotal} KZT</p>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-[var(--muted)]">Известная часть стоимости</p>
              <p className="text-2xl font-semibold">{props.knownSubtotal} KZT</p>
              <p className="mt-2 text-sm text-[var(--danger)]">
                Незаполненных: {props.unknownCount}
              </p>
            </>
          )}
          <p className="mt-2 text-xs text-[var(--muted)]">НДС выходной: {props.outputVatTotal}</p>

          <div className="mt-4 space-y-2 text-sm">
            <button
              type="button"
              className="w-full rounded-md bg-[var(--accent)] px-3 py-2 font-semibold text-white disabled:opacity-50"
              disabled={props.blockedForFixed || issueFeedback.kind === "working"}
              aria-describedby={issueStatusId}
              onClick={() => {
                const fd = new FormData();
                fd.set("estimateId", props.estimateId);
                fd.set("expectedRevision", String(revision));
                fd.set("idempotencyKey", `issue:${props.estimateId}:r${revision}:0`);
                run(() => props.actions.issueVersion(fd), { kind: "issue" });
              }}
            >
              Выпустить версию
            </button>
            {props.blockedForFixed ? (
              <button
                type="button"
                className="w-full rounded-md border border-[var(--border)] px-3 py-2"
                aria-describedby={issueStatusId}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("estimateId", props.estimateId);
                  fd.set("expectedRevision", String(revision));
                  fd.set("allowPreliminary", "1");
                  fd.set("idempotencyKey", `issue:${props.estimateId}:r${revision}:1`);
                  run(() => props.actions.issueVersion(fd), { kind: "issue" });
                }}
              >
                Предварительная версия
              </button>
            ) : null}
            <div id={issueStatusId} className="space-y-1" aria-live="polite">
              {issueFeedback.kind === "working" ? (
                <p className="text-xs text-[var(--muted)]">Выпускаем версию…</p>
              ) : null}
              {issueFeedback.kind === "error" ? (
                <p className="text-xs text-[var(--danger)]" role="alert">
                  {issueFeedback.label}
                </p>
              ) : null}
              {issueFeedback.kind === "success" ? (
                <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-2">
                  <p className="text-xs">
                    Версия №{issueFeedback.versionNumber || "?"} создана
                  </p>
                  <Link
                    href={issueFeedback.href}
                    className="mt-1 inline-block text-sm font-semibold text-[var(--accent)] underline"
                  >
                    Открыть версию №{issueFeedback.versionNumber || ""}
                  </Link>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="w-full rounded-md border border-[var(--border)] px-3 py-2 disabled:opacity-50"
              disabled={pdfBusy || pdfUnavailable}
              aria-describedby={pdfStatusId}
              onClick={() => {
                void downloadDraft("pdf");
              }}
            >
              {pdfUnavailable
                ? "PDF временно недоступен на этом стенде"
                : pdfBusy && pdfFeedback.kind === "working"
                  ? "Подготавливаем PDF…"
                  : "PDF предварительный"}
            </button>
            <div id={pdfStatusId} className="space-y-1" aria-live="polite">
              {pdfFeedback.kind === "working" ? (
                <p className="text-xs text-[var(--muted)]">{pdfFeedback.label}</p>
              ) : null}
              {pdfFeedback.kind === "success" ? (
                <p className="text-xs text-[var(--muted)]">{pdfFeedback.label}</p>
              ) : null}
              {pdfFeedback.kind === "error" ? (
                <div className="rounded-md border border-[var(--danger)]/40 p-2" role="alert">
                  <p className="text-xs text-[var(--danger)]">{pdfFeedback.label}</p>
                  {pdfFeedback.requestId ? (
                    <p className="mt-1 text-[10px] text-[var(--muted)]">
                      Код обращения: {pdfFeedback.requestId}
                    </p>
                  ) : null}
                  {pdfFeedback.detail ? (
                    <details className="mt-1 text-[10px] text-[var(--muted)]">
                      <summary className="cursor-pointer underline">Подробнее</summary>
                      <p className="mt-1">{pdfFeedback.detail}</p>
                    </details>
                  ) : null}
                  {!pdfUnavailable ? (
                    <button
                      type="button"
                      className="mt-1 text-xs text-[var(--accent)] underline"
                      onClick={() => {
                        void downloadDraft("pdf");
                      }}
                    >
                      Повторить
                    </button>
                  ) : null}
                </div>
              ) : null}
              {pdfFallbackUrl ? (
                <a
                  href={pdfFallbackUrl}
                  download={`estimate-draft-r${revision}.pdf`}
                  className="block text-sm text-[var(--accent)] underline"
                >
                  Скачать ещё раз
                </a>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {(["xlsx", "docx", "csv"] as const).map((format) => (
                <button
                  key={format}
                  type="button"
                  className="flex-1 rounded-md border border-[var(--border)] px-2 py-1.5 text-xs disabled:opacity-50"
                  disabled={pdfBusy}
                  onClick={() => {
                    void downloadDraft(format);
                  }}
                >
                  {format.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="w-full rounded-md border border-[var(--border)] px-3 py-2"
              onClick={() => {
                const fd = new FormData();
                fd.set("estimateId", props.estimateId);
                run(async () => {
                  const created = await props.actions.duplicateEstimate(fd);
                  return created;
                });
              }}
            >
              Дублировать смету
            </button>
            <button
              type="button"
              className="w-full rounded-md border border-[var(--border)] px-3 py-2"
              onClick={() => {
                startTransition(async () => {
                  const diffs = await props.actions.comparePrices(props.estimateId);
                  setPriceDiffs(diffs.filter((d) => d.changed || d.offerGone));
                });
              }}
            >
              Обновить цены…
            </button>
          </div>

          {priceDiffs ? (
            <div className="mt-3 rounded-md border border-[var(--border)] p-2 text-xs">
              <p className="font-semibold">Сравнение цен</p>
              {priceDiffs.length === 0 ? (
                <p className="text-[var(--muted)]">Изменений нет</p>
              ) : (
                <>
                  <ul className="mt-1 space-y-1">
                    {priceDiffs.map((d) => (
                      <li key={d.lineId}>
                        {d.name}: {d.oldPrice ?? "—"} → {d.offerGone ? "нет" : d.newPrice ?? "—"}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="mt-2 underline"
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("estimateId", props.estimateId);
                      fd.set("expectedRevision", String(revision));
                      fd.set("lineIds", priceDiffs.map((d) => d.lineId).join(","));
                      run(() => props.actions.applyPrices(fd));
                      setPriceDiffs(null);
                    }}
                  >
                    Применить к выбранным
                  </button>
                </>
              )}
            </div>
          ) : null}

          <div className="mt-6" id="versions">
            <h3 className="text-sm font-semibold">История версий</h3>
            <ul className="mt-2 space-y-2 text-xs">
              {props.versions.length === 0 ? (
                <li className="text-[var(--muted)]">Пока нет</li>
              ) : (
                props.versions.map((v) => (
                  <li key={v.id} className="rounded border border-[var(--border)] p-2">
                    <div>
                      v{v.versionNumber} · {v.documentKind}
                    </div>
                    <div className="text-[var(--muted)]">
                      {new Date(v.issuedAt).toLocaleString("ru-RU")}
                    </div>
                    <button
                      type="button"
                      className="mt-1 text-[var(--accent)] underline"
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("versionId", v.id);
                        fd.set("expiresInDays", "30");
                        run(() => props.actions.createPublicLink(fd), { reload: false });
                      }}
                    >
                      Публичная ссылка
                    </button>
                    <Link
                      href={`/app/versions/${v.id}`}
                      className="ml-2 text-[var(--accent)] underline"
                    >
                      Открыть
                    </Link>
                  </li>
                ))
              )}
            </ul>
            {publicUrl ? (
              <p className="mt-2 break-all text-xs text-[var(--accent-2)]">
                Ссылка: {publicUrl}
              </p>
            ) : null}
            <p className="mt-2 text-[10px] text-[var(--muted)]">
              Публичная ссылка opt-in, noindex. Принятие ≠ ЭЦП.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
