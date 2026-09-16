import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { FeatureStatusBadge } from "@/components/features/FeatureStatusBadge";
import { listFeatures } from "@/modules/features/registry";
import { statusLabel } from "@/modules/features/labels";

export const metadata = {
  title: "Возможности стенда — QuatHub",
  description: "Честный статус функций пилотного стенда QuatHub",
};

export default function CapabilitiesPage() {
  const features = listFeatures();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-[var(--muted)]">
          <Link href="/" className="underline">
            ← На главную
          </Link>
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Возможности стенда
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Пилотный стенд QuatHub. Ниже — фактическая доступность функций, без
          «пустых» кнопок. Статусы обновляются по коду и проверкам.
        </p>

        <ul className="mt-8 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {features.map((f) => (
            <li key={f.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{f.title}</span>
                  <FeatureStatusBadge status={f.status} />
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {statusLabel(f.status)}
                  {f.planStage ? ` · план: ${f.planStage}` : ""}
                </p>
                {f.limitation ? (
                  <p className="mt-1 text-sm text-[var(--muted)]">{f.limitation}</p>
                ) : null}
                {f.alternate ? (
                  <p className="mt-1 text-sm text-[var(--muted)]">{f.alternate}</p>
                ) : null}
              </div>
              <code className="shrink-0 text-[10px] text-[var(--muted)]">{f.id}</code>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
