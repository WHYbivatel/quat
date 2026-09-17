"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useGuestDraft } from "@/components/guest-draft";

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

function kindLabel(kind: string) {
  return kind === "service" ? "Услуга" : "Товар";
}

export function GuestDraftClient(props: {
  isAuthenticated: boolean;
  hasOrg: boolean;
  projects: { id: string; name: string }[];
  userEmail: string | null;
}) {
  const { lines, ready, remove, clear } = useGuestDraft();
  const [qtys, setQtys] = useState<Record<string, string>>({});

  const displayLines = useMemo(
    () =>
      lines.map((l) => ({
        ...l,
        qty: qtys[l.localId] ?? l.qty,
      })),
    [lines, qtys],
  );

  function setQty(localId: string, qty: string) {
    setQtys((prev) => ({ ...prev, [localId]: qty }));
    const next = lines.map((l) =>
      l.localId === localId ? { ...l, qty: qty || "1" } : l,
    );
    try {
      localStorage.setItem("quathub.guestDraft.v1", JSON.stringify(next));
      window.dispatchEvent(new Event("quathub-guest-draft"));
    } catch {
      /* ignore */
    }
  }

  const continueHref = !props.isAuthenticated
    ? `/login?next=${encodeURIComponent("/app/import-draft")}`
    : !props.hasOrg || props.projects.length === 0
      ? `/app/projects`
      : `/app/import-draft`;

  const continueLabel = !props.isAuthenticated
    ? "Войти и продолжить смету"
    : !props.hasOrg
      ? "Создать организацию и продолжить"
      : props.projects.length === 0
        ? "Создать проект и продолжить"
        : "Продолжить в редакторе";

  return (
    <>
      <header className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link href="/" className="font-semibold text-[var(--accent)]">
            QuatHub
          </Link>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link href="/catalog/products" className="underline">
              Товары
            </Link>
            <Link href="/catalog/services" className="underline">
              Услуги
            </Link>
            {props.isAuthenticated ? (
              <span className="text-[var(--muted)]">{props.userEmail}</span>
            ) : (
              <Link href="/login?next=/draft" className="underline">
                Войти
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Локальный черновик
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Без персональных данных. Хранится только в браузере. Цены будут
          перепроверены при переносе в организацию.
        </p>

        {!ready ? (
          <p className="mt-6 text-sm text-[var(--muted)]">Загрузка…</p>
        ) : lines.length === 0 ? (
          <div className="mt-6 space-y-3 text-sm" role="status">
            <p className="text-[var(--muted)]">Черновик пуст.</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/catalog/products"
                className="rounded-md bg-[var(--accent)] px-4 py-2 font-semibold text-white"
              >
                Выбрать товары
              </Link>
              <Link
                href="/catalog/services"
                className="rounded-md border border-[var(--border)] px-4 py-2"
              >
                Выбрать услуги
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ul className="mt-6 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              {displayLines.map((l) => (
                <li
                  key={l.localId}
                  className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{l.name}</div>
                    <div className="text-[var(--muted)]">
                      {kindLabel(l.kind)} · {l.priceLabel}
                    </div>
                    <label className="mt-2 inline-flex items-center gap-2">
                      Кол-во
                      <input
                        type="text"
                        inputMode="decimal"
                        value={l.qty}
                        onChange={(e) => setQty(l.localId, e.target.value)}
                        className="w-20 rounded-md border border-[var(--border)] px-2 py-1"
                        aria-label={`Количество ${l.name}`}
                      />
                      <span>{unitLabel(l.unit)}</span>
                    </label>
                  </div>
                  <button
                    type="button"
                    className="text-[var(--danger)] underline"
                    onClick={() => remove(l.localId)}
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href={continueHref}
                className="inline-flex justify-center rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-2)]"
              >
                {continueLabel}
              </Link>
              <Link
                href="/catalog/products"
                className="inline-flex justify-center rounded-md border border-[var(--border)] px-4 py-2.5 text-sm"
              >
                Добавить ещё
              </Link>
              <button
                type="button"
                className="text-sm text-[var(--muted)] underline"
                onClick={() => clear()}
              >
                Очистить черновик
              </button>
            </div>
            {props.isAuthenticated && props.hasOrg && props.projects.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                Сначала создайте проект — затем вернитесь к переносу из{" "}
                <Link href="/app/import-draft" className="underline">
                  этого шага
                </Link>
                .
              </p>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}
