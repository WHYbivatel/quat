import { cn } from "./cn";

/** Format money with thin spaces; does not round business values beyond provided string/number. */
export function formatMoney(value: string | number | null | undefined, currency = "₸") {
  if (value == null || value === "") return null;
  const raw = String(value);
  const neg = raw.startsWith("-");
  const body = neg ? raw.slice(1) : raw;
  const [intPart, frac] = body.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const out = frac != null ? `${grouped}.${frac}` : grouped;
  return `${neg ? "−" : ""}${out} ${currency}`;
}

export function Price({
  value,
  unit,
  unknown,
  from,
  className,
  size = "md",
}: {
  value?: string | number | null;
  unit?: string | null;
  unknown?: boolean;
  from?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg"
      ? "text-2xl font-semibold"
      : size === "sm"
        ? "text-sm"
        : "text-base font-semibold";

  if (unknown || value == null || value === "") {
    return (
      <span className={cn("tabular-nums text-[var(--text-secondary)]", sizeClass, className)}>
        По запросу
        {unit ? <span className="font-normal">/{unit}</span> : null}
      </span>
    );
  }

  const formatted = formatMoney(value);
  return (
    <span className={cn("tabular-nums text-[var(--text-primary)]", sizeClass, className)}>
      {from ? "от " : null}
      {formatted}
      {unit ? <span className="ml-0.5 font-normal text-[var(--text-secondary)]">/{unit}</span> : null}
    </span>
  );
}
