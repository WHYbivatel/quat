import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { listRegionsAdmin } from "@/modules/administration/refs";

export default async function AdminRegionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const regions = await listRegionsAdmin(session.user.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/app/admin" className="text-sm text-[var(--muted)]">
          ← Админ
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Регионы</h1>
        <ul className="mt-6 space-y-4 text-sm">
          {regions.map((r) => (
            <li key={r.id}>
              <div className="font-medium">
                {r.nameRu} <span className="text-[var(--muted)]">({r.code})</span>
              </div>
              <div className="text-[var(--muted)]">
                {r.cities.map((c) => c.nameRu).join(", ")}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
