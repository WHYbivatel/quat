import Link from "next/link";
import { FeatureStatusBadge } from "./FeatureStatusBadge";
import type { FeatureDefinition } from "@/modules/features/registry";
import { isActionable } from "@/modules/features/registry";

export function FeatureGate(props: {
  feature: FeatureDefinition;
  children: React.ReactNode;
  /** When not actionable, show badge + alternate instead of children */
  fallback?: React.ReactNode;
}) {
  if (isActionable(props.feature.status)) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        {props.children}
        <FeatureStatusBadge status={props.feature.status} />
      </span>
    );
  }
  return (
    props.fallback ?? (
      <span className="inline-flex flex-col gap-1 text-sm text-[var(--muted)]">
        <span className="inline-flex flex-wrap items-center gap-2">
          {props.feature.title}
          <FeatureStatusBadge status={props.feature.status} />
        </span>
        {props.feature.alternate ? (
          <span className="text-xs">{props.feature.alternate}</span>
        ) : null}
        <Link href="/capabilities" className="text-xs text-[var(--accent)] underline">
          Возможности стенда
        </Link>
      </span>
    )
  );
}
