import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { FeatureStatusBadge } from "@/components/features/FeatureStatusBadge";
import { auth } from "@/lib/auth";
import { requirePlatformAdmin } from "@/modules/organizations/access";
import { listFeatures } from "@/modules/features/registry";
import { statusLabel } from "@/modules/features/labels";

export default async function AdminCapabilitiesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await requirePlatformAdmin(session.user.id);
  const features = listFeatures();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/app/admin" className="text-sm text-[var(--muted)]">
          ← Админ
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Матрица возможностей</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Источник истины:{" "}
          <code className="text-xs">src/modules/features/registry.ts</code>.
          Публичная копия:{" "}
          <Link href="/capabilities" className="underline">
            /capabilities
          </Link>
          .
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                <th className="py-2 pr-3 font-medium">ID</th>
                <th className="py-2 pr-3 font-medium">Название</th>
                <th className="py-2 pr-3 font-medium">Статус</th>
                <th className="py-2 font-medium">Ограничение / альтернатива</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f) => (
                <tr key={f.id} className="border-b border-[var(--border)] align-top">
                  <td className="py-2 pr-3 font-mono text-xs">{f.id}</td>
                  <td className="py-2 pr-3">{f.title}</td>
                  <td className="py-2 pr-3">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {statusLabel(f.status)}
                      <FeatureStatusBadge status={f.status} />
                    </span>
                  </td>
                  <td className="py-2 text-[var(--muted)]">
                    {f.limitation || f.alternate || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
