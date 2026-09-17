"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useGuestDraft } from "@/components/guest-draft";
import { useIsDesktopViewport } from "@/components/useViewportMode";
import {
  EmptyState,
  EstimateLine,
  EstimatePanel,
  EstimatePanelBody,
  EstimatePanelFooter,
  Menu,
  MenuItem,
  PanelHeader,
  QuantityStepper,
  Summary,
  formatMoney,
} from "@/components/ui";

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

export function parseEstimatePrice(label: string, unitPrice?: string | null): number | null {
  if (unitPrice != null && unitPrice !== "" && Number.isFinite(Number(unitPrice))) {
    return Number(unitPrice);
  }
  const m = label.replace(/\s/g, "").match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  return Number(m[1].replace(",", "."));
}

export function EstimatePanelContent({
  isAuthenticated,
  importHref,
}: {
  isAuthenticated: boolean;
  importHref: string;
}) {
  const { lines, setQty, remove, count } = useGuestDraft();

  const totals = useMemo(() => {
    let known = 0;
    let unknown = 0;
    for (const l of lines) {
      const p = parseEstimatePrice(l.priceLabel, l.unitPrice);
      const q = Number(l.qty) || 0;
      if (p == null) unknown += 1;
      else known += p * q;
    }
    return { known, unknown, complete: unknown === 0 && lines.length > 0 };
  }, [lines]);

  return (
    <EstimatePanel className="h-full min-h-0">
      <PanelHeader>
        <h2 className="text-lg font-semibold" suppressHydrationWarning>
          {`Смета${count > 0 ? ` · ${count}` : ""}`}
        </h2>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
          {isAuthenticated ? "Локальный набор до сохранения в организацию" : "Локальный черновик"}
        </p>
      </PanelHeader>

      <EstimatePanelBody>
        {lines.length === 0 ? (
          <EmptyState title="Добавьте товары или услуги из каталога" />
        ) : (
          lines.map((line) => {
            const unitPrice = parseEstimatePrice(line.priceLabel, line.unitPrice);
            const qty = Number(line.qty) || 1;
            const lineTotal = unitPrice != null ? unitPrice * qty : null;
            return (
              <EstimateLine
                key={line.localId}
                name={line.name}
                unitPrice={unitPrice}
                unit={unitLabel(line.unit)}
                lineTotal={lineTotal}
                unknownPrice={unitPrice == null}
                onRemove={() => remove(line.localId)}
                stepper={
                  <QuantityStepper
                    value={qty}
                    min={1}
                    onChange={(n) => setQty(line.localId, n)}
                    onRemoveAtMin={() => remove(line.localId)}
                    label={`Количество ${line.name}`}
                    presets={line.unit === "m" || line.unit === "pcs" ? [10, 100] : undefined}
                  />
                }
              />
            );
          })
        )}
      </EstimatePanelBody>

      <EstimatePanelFooter>
        <Summary
          total={lines.length === 0 ? null : totals.known}
          complete={totals.complete}
          knownLabel={
            totals.unknown > 0
              ? `Известная часть · без цены: ${totals.unknown}`
              : "Итого"
          }
        >
          <div className="mt-3 flex flex-col gap-2">
            <Menu
              label="Скачать смету ▾"
              placement="top"
              align="start"
              className="w-full"
              variant="primary"
              size="md"
            >
              {isAuthenticated ? (
                <MenuItem
                  onClick={() => {
                    window.location.href = importHref;
                  }}
                >
                  Сохранить и скачать PDF
                </MenuItem>
              ) : (
                <MenuItem
                  onClick={() => {
                    window.location.href = `/login?next=${encodeURIComponent(importHref)}`;
                  }}
                >
                  Войти, чтобы скачать PDF
                </MenuItem>
              )}
              <MenuItem disabled>XLSX · после сохранения</MenuItem>
              <MenuItem disabled>DOCX · после сохранения</MenuItem>
            </Menu>
            {count > 0 ? (
              <Link
                href={isAuthenticated ? importHref : `/login?next=${encodeURIComponent(importHref)}`}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-button)] border border-[#CED2C8] bg-[var(--control)] px-4 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
              >
                {isAuthenticated ? "Сохранить в аккаунт" : "Войти и сохранить"}
              </Link>
            ) : null}
            {lines.length > 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                Предварительно: {formatMoney(totals.known) ?? "—"}
              </p>
            ) : null}
          </div>
        </Summary>
      </EstimatePanelFooter>
    </EstimatePanel>
  );
}

/** Desktop estimate column — single Workspace grid child */
export function EstimateSidePanel({
  isAuthenticated,
  importHref,
}: {
  isAuthenticated: boolean;
  importHref: string;
}) {
  const isDesktop = useIsDesktopViewport();
  if (!isDesktop) return null;

  return (
    <aside className="qh-estimate-col" data-testid="estimate-desktop">
      <EstimatePanelContent isAuthenticated={isAuthenticated} importHref={importHref} />
    </aside>
  );
}
