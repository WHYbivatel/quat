import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth, signOut } from "@/lib/auth";
import {
  getOrCreateActiveOrganizationId,
  listMemberships,
  setActiveOrganization,
} from "@/modules/organizations/access";
import { listProjectsForUser } from "@/modules/projects/service";
import { can } from "@/lib/permissions";
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

export default async function AppPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/app");

  const userId = session.user.id;
  const memberships = await listMemberships(userId);
  const activeOrgId = await getOrCreateActiveOrganizationId(userId);
  const activeMembership = memberships.find((m) => m.organizationId === activeOrgId);
  const activeOrg = activeMembership?.organization;
  const role = activeMembership?.role;
  const canWrite = role ? can(role, "project:write") : false;

  let projects: Awaited<ReturnType<typeof listProjectsForUser>> = [];
  try {
    projects = await listProjectsForUser(userId);
  } catch {
    projects = [];
  }

  const stats = {
    products: await prisma.catalogItem.count({
      where: { kind: "product", status: "active" },
    }),
    services: await prisma.catalogItem.count({
      where: { kind: "service", status: "active" },
    }),
  };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl">
              Рабочая область
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {session.user.email}
              {activeOrg ? (
                <>
                  {" "}
                  · <strong>{activeOrg.name}</strong> ({role})
                </>
              ) : (
                " · нет организации"
              )}
            </p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="text-sm underline">
              Выйти
            </button>
          </form>
        </header>

        <section className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/catalog/products"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--accent)]"
          >
            <div className="text-lg font-semibold">Товары</div>
            <div className="text-sm text-[var(--muted)]">
              {stats.products} позиций · добавить в смету
            </div>
          </Link>
          <Link
            href="/catalog/services"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--accent)]"
          >
            <div className="text-lg font-semibold">Услуги</div>
            <div className="text-sm text-[var(--muted)]">
              {stats.services} позиций · добавить в смету
            </div>
          </Link>
          <Link
            href="/app/projects"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--accent)] sm:col-span-2"
          >
            <div className="text-lg font-semibold">Мои проекты и сметы</div>
            <div className="text-sm text-[var(--muted)]">
              {projects.length} проект(ов)
              {canWrite ? "" : " · создание смет недоступно для этой роли"}
            </div>
          </Link>
        </section>

        {memberships.length > 1 ? (
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
        ) : null}

        <section className="mt-8">
          <h2 className="font-semibold">Недавние проекты</h2>
          <ul className="mt-3 divide-y rounded-lg border">
            {projects.length === 0 ? (
              <li className="p-4 text-sm text-[var(--muted)]">
                Пока нет проектов.{" "}
                <Link href="/app/projects" className="underline">
                  Создать
                </Link>{" "}
                или{" "}
                <Link href="/catalog/products" className="underline">
                  выбрать товары
                </Link>
                .
              </li>
            ) : (
              projects.slice(0, 5).map((p) => (
                <li key={p.id} className="p-4 text-sm">
                  <Link href="/app/projects" className="font-medium underline">
                    {p.name}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </section>
      </main>
    </>
  );
}
