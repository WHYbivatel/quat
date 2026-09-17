"use client";

import { useMemo, useState } from "react";
import { useGuestDraft } from "@/components/guest-draft";
import {
  EstimatePanelContent,
  parseEstimatePrice,
} from "@/components/EstimateSidePanel";
import { useIsDesktopViewport } from "@/components/useViewportMode";
import { Price, Sheet } from "@/components/ui";

/** Mobile bottom bar + sheet — only when viewport < 1000px */
export function EstimateMobileChrome({
  isAuthenticated,
  importHref,
}: {
  isAuthenticated: boolean;
  importHref: string;
}) {
  const isDesktop = useIsDesktopViewport();
  const { count, lines } = useGuestDraft();
  const [sheetOpen, setSheetOpen] = useState(false);

  const known = useMemo(() => {
    let sum = 0;
    for (const l of lines) {
      const p = parseEstimatePrice(l.priceLabel, l.unitPrice);
      const q = Number(l.qty) || 0;
      if (p != null) sum += p * q;
    }
    return sum;
  }, [lines]);

  if (isDesktop) return null;

  return (
    <>
      <div
        className="qh-estimate-mobile-bar fixed inset-x-0 bottom-0 z-30 bg-[var(--page)] px-3 pt-3"
        data-testid="estimate-mobile-bar"
      >
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-[var(--radius-button)] bg-[var(--brand)] px-4 py-3 text-sm font-semibold text-[var(--brand-foreground)]"
          onClick={() => setSheetOpen(true)}
        >
          <span suppressHydrationWarning>
            Смета · {count} {count === 1 ? "позиция" : "позиций"}
          </span>
          <Price value={known || null} size="sm" unknown={count === 0} />
        </button>
      </div>
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={`Смета · ${count}`}>
        <div className="flex h-[min(70dvh,640px)] min-h-[40vh] flex-col overflow-hidden">
          <EstimatePanelContent isAuthenticated={isAuthenticated} importHref={importHref} />
        </div>
      </Sheet>
    </>
  );
}
