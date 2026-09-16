import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { FeatureStatusBadge } from "@/components/features/FeatureStatusBadge";
import {
  FEATURES,
  type FeatureId,
  type FeatureDefinition,
} from "@/modules/features/registry";

type Props = {
  searchParams?: Promise<{ feature?: string }>;
};

function resolveFeature(id: string | undefined): FeatureDefinition {
  if (id && id in FEATURES) {
    return FEATURES[id as FeatureId];
  }
  return FEATURES["normative.kz"];
}

export default async function ComingSoonPage({ searchParams }: Props) {
  const sp = searchParams ? await searchParams : {};
  const feature = resolveFeature(sp.feature);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <FeatureStatusBadge status={feature.status} />
        <h1 className="mt-4 text-2xl font-semibold">{feature.title}</h1>
        <p className="mt-3 text-[var(--muted)]">
          {feature.alternate ||
            feature.limitation ||
            "Эта возможность ещё не включена на пилотном стенде."}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
          <Link
            href="/capabilities"
            className="rounded-md bg-[var(--accent)] px-4 py-2 font-semibold text-white"
          >
            Все возможности
          </Link>
          <Link href="/" className="rounded-md border border-[var(--border)] px-4 py-2">
            На главную
          </Link>
        </div>
      </main>
    </>
  );
}
