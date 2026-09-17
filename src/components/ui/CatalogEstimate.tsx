import type { ReactNode } from "react";
import { cn } from "./cn";
import { Price } from "./Price";
import { Badge } from "./Badge";
import { Button } from "./Button";

export function CatalogRow({
  name,
  meta,
  price,
  unit,
  unknownPrice,
  supplier,
  demo,
  action,
  className,
}: {
  name: ReactNode;
  meta?: ReactNode;
  price?: string | number | null;
  unit?: string | null;
  unknownPrice?: boolean;
  supplier?: string | null;
  demo?: boolean;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "qh-catalog-row flex items-start justify-between gap-4 border-b border-[var(--border)] last:border-b-0",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{name}</h3>
          {demo ? <Badge tone="info">демо</Badge> : null}
        </div>
        {meta ? <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-secondary)]">{meta}</p> : null}
        {supplier ? <p className="mt-1 text-xs text-[var(--text-secondary)]">{supplier}</p> : null}
        <div className="mt-2">
          <Price value={price} unit={unit} unknown={unknownPrice} size="sm" />
        </div>
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </article>
  );
}

export function EstimateLine({
  name,
  unitPrice,
  unit,
  lineTotal,
  unknownPrice,
  stepper,
  onRemove,
  individualTerms,
  className,
}: {
  name: ReactNode;
  unitPrice?: string | number | null;
  unit?: string | null;
  lineTotal?: string | number | null;
  unknownPrice?: boolean;
  stepper: ReactNode;
  onRemove?: () => void;
  individualTerms?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-[var(--border)] py-3 last:border-b-0", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-snug text-[var(--text-primary)]">{name}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            <Price value={unitPrice} unit={unit} unknown={unknownPrice} size="sm" />
          </p>
          {individualTerms ? (
            <Badge tone="warning" className="mt-1">
              Индивидуальные условия
            </Badge>
          ) : null}
        </div>
        {onRemove ? (
          <Button type="button" variant="ghost" size="sm" className="shrink-0 text-[var(--error)]" onClick={onRemove}>
            Удалить
          </Button>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        {stepper}
        <Price value={lineTotal} unknown={unknownPrice} size="sm" className="font-semibold" />
      </div>
    </div>
  );
}

export function Summary({
  total,
  complete,
  knownLabel,
  children,
  className,
}: {
  total: string | number | null;
  complete: boolean;
  knownLabel?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-t border-[var(--border)] bg-[var(--panel)] pt-3",
        className,
      )}
    >
      <p className="text-sm text-[var(--text-secondary)]">
        {complete ? "Итого" : knownLabel ?? "Известная часть стоимости"}
      </p>
      <p className="mt-1">
        <Price value={total} size="lg" unknown={total == null} />
      </p>
      {children}
    </div>
  );
}
