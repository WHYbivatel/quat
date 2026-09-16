"use client";

import Link from "next/link";
import { useGuestDraft } from "@/components/AddToEstimateButton";

export default function GuestDraftPage() {
  const { lines, ready, remove, clear } = useGuestDraft();

  return (
    <>
      <header className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="font-semibold text-[var(--accent)]">
            QuatHub
          </Link>
          <Link href="/login" className="text-sm underline">
            Войти, чтобы перенести в организацию
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Локальный черновик
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Без персональных данных. Хранится только в браузере.
        </p>

        {!ready ? (
          <p className="mt-6 text-sm text-[var(--muted)]">Загрузка…</p>
        ) : lines.length === 0 ? (
          <p className="mt-6 text-sm text-[var(--muted)]" role="status">
            Пусто.{" "}
            <Link href="/catalog/products" className="text-[var(--accent)] underline">
              Открыть каталог
            </Link>
          </p>
        ) : (
          <>
            <ul className="mt-6 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              {lines.map((l) => (
                <li
                  key={l.localId}
                  className="flex items-start justify-between gap-3 p-4 text-sm"
                >
                  <div>
                    <div className="font-medium">{l.name}</div>
                    <div className="text-[var(--muted)]">
                      {l.qty} {l.unit} · {l.priceLabel} · {l.kind}
                    </div>
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
            <button
              type="button"
              className="mt-4 text-sm text-[var(--muted)] underline"
              onClick={() => clear()}
            >
              Очистить черновик
            </button>
          </>
        )}
      </main>
    </>
  );
}
