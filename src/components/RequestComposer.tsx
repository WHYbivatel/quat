"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitRequestsAction } from "@/app/actions/requests";

type Group = {
  supplierOrganizationId: string | null;
  supplierName: string | null;
  lines: Array<{ estimateLineId: string; name: string; unit: string; qty: string }>;
};

export function RequestComposer(props: {
  versionId: string;
  groups: Group[];
  unassigned: Group;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of props.groups) {
      if (g.supplierOrganizationId) init[g.supplierOrganizationId] = true;
    }
    return init;
  });
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const assignments = useMemo(() => {
    return props.groups
      .filter((g) => g.supplierOrganizationId && selected[g.supplierOrganizationId])
      .map((g) => ({
        supplierOrganizationId: g.supplierOrganizationId!,
        estimateLineIds: g.lines.map((l) => l.estimateLineId),
      }));
  }, [props.groups, selected]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Предпросмотр. Ничего не отправляется, пока не нажмёте «Отправить заявки».
        Оплата вне платформы.
      </p>

      {props.groups.map((g) => (
        <label
          key={g.supplierOrganizationId ?? "x"}
          className="flex cursor-pointer gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <input
            type="checkbox"
            className="mt-1"
            checked={Boolean(g.supplierOrganizationId && selected[g.supplierOrganizationId])}
            onChange={(e) => {
              if (!g.supplierOrganizationId) return;
              setSelected((s) => ({
                ...s,
                [g.supplierOrganizationId!]: e.target.checked,
              }));
            }}
          />
          <div className="flex-1 text-sm">
            <div className="font-semibold">{g.supplierName}</div>
            <ul className="mt-2 space-y-1 text-[var(--muted)]">
              {g.lines.map((l) => (
                <li key={l.estimateLineId}>
                  {l.name} · {l.qty} {l.unit}
                </li>
              ))}
            </ul>
          </div>
        </label>
      ))}

      {props.unassigned.lines.length > 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-sm">
          <div className="font-semibold">Без поставщика (не отправляются)</div>
          <ul className="mt-2 text-[var(--muted)]">
            {props.unassigned.lines.map((l) => (
              <li key={l.estimateLineId}>
                {l.name} · {l.qty} {l.unit}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">Назначьте поставщика в смете или оставьте неотправленными.</p>
        </div>
      ) : null}

      <button
        type="button"
        disabled={pending || assignments.length === 0}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        onClick={() => {
          setMsg(null);
          startTransition(async () => {
            const fd = new FormData();
            fd.set("versionId", props.versionId);
            fd.set("assignments", JSON.stringify(assignments));
            fd.set("idempotencyKey", idempotencyKey);
            const res = await submitRequestsAction(fd);
            if (!res.ok) {
              setMsg(res.error);
              return;
            }
            setMsg(
              res.duplicated
                ? `Повтор: заявки уже созданы (${res.count})`
                : `Создано заявок: ${res.count}`,
            );
            router.push("/app/requests");
            router.refresh();
          });
        }}
      >
        {pending ? "Отправка…" : "Отправить заявки"}
      </button>
      {msg ? <p className="text-sm text-[var(--muted)]">{msg}</p> : null}
    </div>
  );
}
