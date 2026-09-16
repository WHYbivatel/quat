"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useGuestDraft } from "@/components/AddToEstimateButton";
import { importGuestDraftAction } from "@/app/actions/estimate";

export default function ImportDraftClient({
  projects,
}: {
  projects: { id: string; name: string }[];
}) {
  const { lines, ready, clear } = useGuestDraft();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const payload = useMemo(
    () =>
      JSON.stringify(
        lines.map((l) => ({
          catalogItemId: l.catalogItemId,
          offerId: l.offerId,
          qty: l.qty,
        })),
      ),
    [lines],
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">
        Перенос локального черновика
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Явный перенос в организацию. Цены будут взяты из текущих предложений при
        добавлении; проверьте смету после импорта.
      </p>

      {!ready ? (
        <p className="mt-6 text-sm">Загрузка…</p>
      ) : lines.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--muted)]">
          Локальный черновик пуст.{" "}
          <Link href="/catalog/products" className="underline">
            Каталог
          </Link>
        </p>
      ) : (
        <>
          <ul className="mt-6 space-y-2 text-sm">
            {lines.map((l) => (
              <li key={l.localId} className="rounded border border-[var(--border)] p-2">
                {l.name} · {l.qty} {l.unit} · {l.priceLabel}
              </li>
            ))}
          </ul>
          {projects.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--danger)]">
              Сначала создайте проект.{" "}
              <Link href="/app/projects" className="underline">
                Мои проекты
              </Link>
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-sm">
                Проект
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="mt-1 block rounded-md border px-2 py-1"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={pending || !projectId}
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => {
                  setMsg(null);
                  startTransition(async () => {
                    const fd = new FormData();
                    fd.set("projectId", projectId);
                    fd.set("payload", payload);
                    const res = await importGuestDraftAction(fd);
                    if (!res.ok) {
                      setMsg(res.error);
                      return;
                    }
                    clear();
                    if (res.href) router.push(res.href);
                  });
                }}
              >
                {pending ? "Переносим…" : "Перенести в организацию"}
              </button>
            </div>
          )}
          {msg ? <p className="mt-3 text-sm text-[var(--danger)]">{msg}</p> : null}
        </>
      )}
    </main>
  );
}
