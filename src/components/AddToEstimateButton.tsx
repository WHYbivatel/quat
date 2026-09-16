"use client";

import { useCallback, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";

export type GuestDraftLine = {
  localId: string;
  catalogItemId: string;
  offerId?: string;
  name: string;
  unit: string;
  qty: string;
  priceLabel: string;
  kind: "product" | "service";
};

const KEY = "quathub.guestDraft.v1";
const EVENT = "quathub-guest-draft";

function loadRaw(): string {
  if (typeof window === "undefined") return "[]";
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parse(raw: string): GuestDraftLine[] {
  try {
    const parsed = JSON.parse(raw) as GuestDraftLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(lines: GuestDraftLine[]) {
  localStorage.setItem(KEY, JSON.stringify(lines));
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(EVENT, onStoreChange);
  };
}

export function useGuestDraft() {
  const raw = useSyncExternalStore(subscribe, loadRaw, () => "[]");
  const lines = useMemo(() => parse(raw), [raw]);
  const ready = typeof window !== "undefined";

  const add = useCallback((line: Omit<GuestDraftLine, "localId">) => {
    const next = [...parse(loadRaw()), { ...line, localId: crypto.randomUUID() }];
    save(next);
  }, []);

  const remove = useCallback((localId: string) => {
    save(parse(loadRaw()).filter((l) => l.localId !== localId));
  }, []);

  const clear = useCallback(() => {
    save([]);
  }, []);

  return { lines, ready, add, remove, clear, count: lines.length };
}


type AddButtonProps = {
  catalogItemId: string;
  offerId?: string;
  name: string;
  unit: string;
  priceLabel: string;
  kind: "product" | "service";
  projects: { id: string; name: string }[];
  isAuthenticated: boolean;
  addAction: (formData: FormData) => Promise<{ ok: true; href: string } | { ok: false; error: string }>;
};

export function AddToEstimateButton(props: AddButtonProps) {
  const router = useRouter();
  const guest = useGuestDraft();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(props.projects[0]?.id ?? "");

  const canServer = props.isAuthenticated && props.projects.length > 0;

  const label = useMemo(
    () => (props.priceLabel.includes("запросу") ? "В смету (без цены)" : "В смету"),
    [props.priceLabel],
  );

  return (
    <div className="flex flex-col gap-2">
      {canServer ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Проект
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="rounded-md border border-[var(--border)] px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            >
              {props.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={pending || !projectId}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-2)]"
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                const fd = new FormData();
                fd.set("projectId", projectId);
                fd.set("catalogItemId", props.catalogItemId);
                if (props.offerId) fd.set("offerId", props.offerId);
                fd.set("qty", "1");
                const res = await props.addAction(fd);
                if (!res.ok) {
                  setMessage(res.error);
                  return;
                }
                setMessage("Добавлено в черновик");
                router.push(res.href);
                router.refresh();
              });
            }}
          >
            {pending ? "Добавляем…" : label}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-2)]"
          onClick={() => {
            guest.add({
              catalogItemId: props.catalogItemId,
              offerId: props.offerId,
              name: props.name,
              unit: props.unit,
              qty: "1",
              priceLabel: props.priceLabel,
              kind: props.kind,
            });
            setMessage(
              props.isAuthenticated
                ? "Нет проекта — создайте в «Мои проекты». Строка сохранена локально."
                : "Добавлено в локальный черновик (без персональных данных). Войдите, чтобы перенести в организацию.",
            );
          }}
        >
          {label}
        </button>
      )}
      {message ? (
        <p className="text-sm text-[var(--muted)]" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function GuestDraftBadge() {
  const { count, ready } = useGuestDraft();
  if (!ready || count === 0) return null;
  return (
    <a
      href="/draft"
      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
    >
      Черновик: {count}
    </a>
  );
}
