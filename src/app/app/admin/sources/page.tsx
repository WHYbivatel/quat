import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { requirePlatformAdmin } from "@/modules/organizations/access";
import { prisma } from "@/lib/db";
import { republishSourcesAction } from "@/app/actions/admin";

export default async function AdminSourcesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await requirePlatformAdmin(session.user.id);

  const providers = await prisma.sourceProvider.findMany({
    include: {
      _count: { select: { listings: true } },
      runs: { orderBy: { startedAt: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  });
  const versions = await prisma.catalogDataVersion.findMany({
    orderBy: { publishedAt: "desc" },
    take: 5,
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/app/admin" className="text-sm text-[var(--muted)]">
          ← Админ
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Источники публичных прайсов</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Внешние SourceProvider ≠ Organization. Автосбор только при явном
          разрешении; сейчас — curated manual publish.
        </p>
        <form action={republishSourcesAction} className="mt-4">
          <button
            type="submit"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm text-white"
          >
            Опубликовать curated-набор заново
          </button>
        </form>
        <ul className="mt-6 space-y-4 text-sm">
          {providers.map((p) => (
            <li key={p.id} className="rounded border p-4">
              <div className="font-medium">{p.name}</div>
              <div className="text-[var(--muted)]">
                {p.domain} · listings {p._count.listings} · autoSync{" "}
                {p.autoSync ? "on" : "off"}
              </div>
              {p.runs[0] ? (
                <div className="mt-1 text-xs">
                  Last run: {p.runs[0].status} · +{p.runs[0].addedCount} ~{p.runs[0].changedCount}{" "}
                  stale {p.runs[0].removedCount}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <h2 className="mt-8 font-semibold">CatalogDataVersion</h2>
        <ul className="mt-2 space-y-1 text-xs">
          {versions.map((v) => (
            <li key={v.id}>
              {v.publishedAt.toISOString()} · {v.label}
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
