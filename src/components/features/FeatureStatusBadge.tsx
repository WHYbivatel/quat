import { statusLabel } from "@/modules/features/labels";
import type { FeatureStatus } from "@/modules/features/registry";

const tone: Record<FeatureStatus, string> = {
  AVAILABLE: "border-[var(--border)] text-[var(--muted)]",
  LIMITED: "border-[var(--accent-2)] text-[var(--accent-2)]",
  COMING_SOON: "border-[var(--border)] bg-[var(--bg)] text-[var(--muted)]",
  UNAVAILABLE_ENV: "border-[var(--border)] text-[var(--muted)]",
  NO_PERMISSION: "border-[var(--danger)] text-[var(--danger)]",
  TEMPORARILY_UNAVAILABLE: "border-[var(--danger)] text-[var(--danger)]",
};

export function FeatureStatusBadge(props: {
  status: FeatureStatus;
  className?: string;
}) {
  if (props.status === "AVAILABLE") return null;
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone[props.status]} ${props.className ?? ""}`}
    >
      {statusLabel(props.status)}
    </span>
  );
}
