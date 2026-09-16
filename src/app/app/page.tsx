import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import {
  getOrCreateActiveOrganizationId,
  listMemberships,
  setActiveOrganization,
} from "@/modules/organizations/access";
import { listProjectsForUser } from "@/modules/projects/service";
import { prisma } from "@/lib/db";

async function switchOrgAction(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const organizationId = String(formData.get("organizationId") ?? "");
  await setActiveOrganization(session.user.id, organizationId);
  redirect("/app");
}

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

async function createProjectAction(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/app");
  const { createProjectForUser } = await import("@/modules/projects/service");
  await createProjectForUser(session.user.id, { name });
  redirect("/app");
}

export default async function AppPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const memberships = await listMemberships(userId);
  const activeOrgId = await getOrCreateActiveOrganizationId(userId);
  const activeOrg = memberships.find((m) => m.organizationId === activeOrgId)?.organization;
  const projects = await listProjectsForUser(userId);

  const stats = {
    products: await prisma.catalogItem.count({ where: { kind: "product", isDemo: true } }),
    services: await prisma.catalogItem.count({ where: { kind: "service", isDemo: true } }),
    offers: await prisma.offer.count({ where: { isDemo: true } }),
  };

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-[var(--accent)]">
            QuatHub
          </Link>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
            Рабочая область
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {session.user.email} · активная организация:{" "}
            <strong>{activeOrg?.name ?? "—"}</strong>
          </p>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="text-sm text-[var(--muted)] underline">
            Выйти
          </button>
        </form>
      </header>

      <section className="mt-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="font-semibold">Организации</h2>
        <ul className="mt-3 space-y-2">
          {memberships.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
              <span>
                {m.organization.name}{" "}
                <span className="text-[var(--muted)]">({m.role})</span>
              </span>
              {m.organizationId === activeOrgId ? (
                <span className="text-[var(--accent)]">активна</span>
              ) : (
                <form action={switchOrgAction}>
                  <input type="hidden" name="organizationId" value={m.organizationId} />
                  <button type="submit" className="underline">
                    Сделать активной
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Товары (демо)" value={stats.products} />
        <Stat label="Услуги (демо)" value={stats.services} />
        <Stat label="Предложения (демо)" value={stats.offers} />
      </section>

      <section className="mt-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Проекты организации</h2>
        </div>
        <form action={createProjectAction} className="mt-4 flex flex-wrap gap-2">
          <input
            name="name"
            required
            placeholder="Название проекта"
            className="min-w-[220px] flex-1 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            Создать
          </button>
        </form>
        <ul className="mt-4 divide-y divide-[var(--border)]">
          {projects.length === 0 ? (
            <li className="py-3 text-sm text-[var(--muted)]">Пока нет проектов.</li>
          ) : (
            projects.map((p) => (
              <li key={p.id} className="py-3 text-sm">
                <div className="font-medium">{p.name}</div>
                <div className="text-[var(--muted)]">{p.objectName ?? "без объекта"}</div>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-[var(--muted)]">{label}</div>
    </div>
  );
}
