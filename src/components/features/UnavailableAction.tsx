"use client";

import { useId, useState } from "react";
import { FeatureStatusBadge } from "./FeatureStatusBadge";
import type { FeatureDefinition } from "@/modules/features/registry";
import { statusLabel } from "@/modules/features/labels";

export function UnavailableAction(props: {
  feature: FeatureDefinition;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const detail =
    props.feature.limitation ||
    props.feature.alternate ||
    "Функция ещё не доступна на этом стенде.";

  return (
    <span className={`relative inline-flex max-w-full flex-col gap-1 ${props.className ?? ""}`}>
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-describedby={id}
        className="inline-flex cursor-not-allowed flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--muted)] opacity-80"
      >
        <span>
          {props.feature.title}
          <span className="sr-only"> — {statusLabel(props.feature.status)}</span>
        </span>
        <FeatureStatusBadge status={props.feature.status} />
      </button>
      <button
        type="button"
        className="self-start text-left text-xs text-[var(--accent)] underline"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Скрыть пояснение" : "Почему недоступно"}
      </button>
      <p id={id} hidden={!open} className="max-w-xs text-xs text-[var(--muted)]">
        {detail}
      </p>
    </span>
  );
}
