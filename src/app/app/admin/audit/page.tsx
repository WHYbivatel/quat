import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { requirePlatformAdmin } from "@/modules/organizations/access";
import { listAuditEvents } from "@/modules/administration/audit";

export default async function AdminAuditPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await requirePlatformAdmin(session.user.id);
  const events = await listAuditEvents({ limit: 100 });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/app/admin" className="text-sm text-[var(--muted)]">
          ← Админ
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">История изменений</h1>
        <ul className="mt-6 space-y-2 text-xs">
          {events.map((e) => (
            <li key={e.id} className="border-b py-2">
              <div>
                {e.createdAt.toISOString()} · {e.actor?.email ?? "—"} ·{" "}
                {e.entityType}/{e.entityId} · {e.action}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
