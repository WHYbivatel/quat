"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useGuestDraft } from "@/components/guest-draft";
import { Button, QuantityStepper } from "@/components/ui";

type AddButtonProps = {
  catalogItemId: string;
  offerId?: string;
  name: string;
  unit: string;
  priceLabel: string;
  unitPrice?: string | null;
  kind: "product" | "service";
  projects: { id: string; name: string }[];
  isAuthenticated: boolean;
  activeProjectId?: string | null;
  addAction: (formData: FormData) => Promise<
    | { ok: true; href: string; estimateId?: string; projectId?: string }
    | { ok: false; error: string }
  >;
  compact?: boolean;
  preferLocal?: boolean;
};

export function AddToEstimateButton(props: AddButtonProps) {
  const guest = useGuestDraft();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const preferLocal = props.preferLocal !== false;

  const existing = useMemo(
    () =>
      guest.lines.find(
        (l) =>
          l.catalogItemId === props.catalogItemId &&
          (l.offerId ?? "") === (props.offerId ?? "") &&
          l.unit === props.unit,
      ),
    [guest.lines, props.catalogItemId, props.offerId, props.unit],
  );

  function addGuest() {
    guest.add({
      catalogItemId: props.catalogItemId,
      offerId: props.offerId,
      name: props.name,
      unit: props.unit,
      qty: "1",
      priceLabel: props.priceLabel,
      unitPrice: props.unitPrice,
      kind: props.kind,
    });
  }

  function onAdd() {
    setMessage(null);
    if (preferLocal) {
      addGuest();
      return;
    }
    const projectId = props.activeProjectId || props.projects[0]?.id;
    if (!props.isAuthenticated || !projectId) {
      addGuest();
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("catalogItemId", props.catalogItemId);
      if (props.offerId) fd.set("offerId", props.offerId);
      fd.set("qty", "1");
      const res = await props.addAction(fd);
      if (!res.ok) {
        setMessage(res.error);
        addGuest();
      }
    });
  }

  if (existing && preferLocal) {
    const qty = Number(existing.qty) || 1;
    return (
      <QuantityStepper
        value={qty}
        min={1}
        label={`Количество ${props.name}`}
        onChange={(n) => guest.setQty(existing.localId, n)}
        onRemoveAtMin={() => guest.remove(existing.localId)}
      />
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" pending={pending} onClick={onAdd}>
        {pending ? "…" : "Добавить"}
      </Button>
      {message ? (
        <p className="max-w-[12rem] text-right text-xs text-[var(--error)]" role="alert">
          {message}
        </p>
      ) : null}
      {!props.compact && !props.isAuthenticated ? (
        <Link
          href={`/login?next=${encodeURIComponent("/catalog/products")}`}
          className="text-xs text-[var(--text-secondary)] underline"
        >
          Войти для сохранения
        </Link>
      ) : null}
    </div>
  );
}
