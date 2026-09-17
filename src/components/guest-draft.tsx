"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

export type GuestDraftLine = {
  localId: string;
  catalogItemId: string;
  offerId?: string;
  name: string;
  unit: string;
  qty: string;
  priceLabel: string;
  unitPrice?: string | null;
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

function sameOffer(a: GuestDraftLine, b: Omit<GuestDraftLine, "localId" | "qty">) {
  return (
    a.catalogItemId === b.catalogItemId &&
    (a.offerId ?? "") === (b.offerId ?? "") &&
    a.unit === b.unit &&
    a.priceLabel === b.priceLabel
  );
}

export function useGuestDraft() {
  const raw = useSyncExternalStore(subscribe, loadRaw, () => "[]");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const lines = useMemo(() => (hydrated ? parse(raw) : []), [raw, hydrated]);

  const add = useCallback((line: Omit<GuestDraftLine, "localId">) => {
    const current = parse(loadRaw());
    const idx = current.findIndex((l) => sameOffer(l, line));
    if (idx >= 0) {
      const prev = Number(current[idx].qty) || 0;
      const inc = Number(line.qty) || 1;
      const next = [...current];
      next[idx] = { ...next[idx], qty: String(prev + inc) };
      save(next);
      return next[idx].localId;
    }
    const localId = crypto.randomUUID();
    save([...current, { ...line, localId }]);
    return localId;
  }, []);

  const setQty = useCallback((localId: string, qty: string | number) => {
    const q = String(qty);
    const next = parse(loadRaw()).map((l) =>
      l.localId === localId ? { ...l, qty: q || "1" } : l,
    );
    save(next);
  }, []);

  const remove = useCallback((localId: string) => {
    save(parse(loadRaw()).filter((l) => l.localId !== localId));
  }, []);

  const clear = useCallback(() => {
    save([]);
  }, []);

  return { lines, ready: hydrated, add, setQty, remove, clear, count: lines.length };
}

export function GuestDraftBadge() {
  const { count, ready } = useGuestDraft();
  if (!ready || count === 0) return null;
  return (
    <Link
      href="/catalog/products"
      className="rounded-[var(--radius-button)] border border-[var(--border)] bg-[var(--control)] px-3 py-1.5 text-sm"
    >
      Смета: {count}
    </Link>
  );
}
