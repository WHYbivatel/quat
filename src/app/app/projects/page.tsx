import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import {
  AccessDeniedError,
  createOrganizationForUser,
  createProjectForUser,
  listProjectsForUser,
} from "@/modules/projects/service";
import {
  getOrCreateActiveOrganizationId,
  listMemberships,
  requireAuthContext,
  setActiveOrganization,
} from "@/modules/organizations/access";
import { ensureDraftEstimate } from "@/modules/estimates/draft";
import { applyTemplateAction } from "@/app/actions/estimate";
import { listTemplates } from "@/modules/estimates/price-refresh";
import { publicErrorRef } from "@/lib/safe-url";
import { CreateProjectForm } from "@/components/CreateProjectForm";
import { Panel } from "@/components/ui";

async function switchOrgAction(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await setActiveOrganization(
    session.user.id,
    String(formData.get("organizationId") ?? ""),
  );
  redirect("/app/projects");
}

async function createOrgAction(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  try {
    await createOrganizationForUser(session.user.id, {
      name: String(formData.get("name") ?? ""),
      type: "buyer",
    });
  } catch (e) {
    const ref = publicErrorRef();
    console.error(`[${ref}] createOrg`, e);
    redirect(`/app/projects?error=${encodeURIComponent(
      e instanceof AccessDeniedError
        ? e.message
        : `Не удалось создать организацию (обращение ${ref})`,
    )}`);
  }
  redirect("/app/projects");
}

async function createProjectAction(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/app/projects");
  const name = String(formData.get("name") ?? "").trim();
  const cityId = String(formData.get("cityId") ?? "") || undefined;
  const templateCode = String(formData.get("templateCode") ?? "") || undefined;
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "") || undefined;
  const organizationId = String(formData.get("organizationId") ?? "") || undefined;
  if (!name) {
    redirect("/app/projects?error=" + encodeURIComponent("Укажите название проекта"));
  }
  try {
    const project = await createProjectForUser(session.user.id, {
      name,
      cityId,
      idempotencyKey,
      organizationId,
    });
    const { invalidateCache } = await import("@/modules/cache/invalidate");
    const { cacheTags } = await import("@/modules/cache/tags");
    await invalidateCache({
      tags: [cacheTags.organizationProjects(project.organizationId)],
      paths: ["/app/projects"],
    });
    const estimate = await ensureDraftEstimate(session.user.id, project.id);
    if (templateCode) {
      const fd = new FormData();
      fd.set("projectId", project.id);
      fd.set("templateCode", templateCode);
      await applyTemplateAction(fd);
    }
    redirect(`/app/projects/${project.id}/estimates/${estimate.id}`);
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "digest" in e &&
      String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw e;
    }
    const ref = publicErrorRef();
    console.error(`[${ref}] createProject`, e);
    const msg =
      e instanceof AccessDeniedError
        ? e.message.includes("permission")
          ? "Недостаточно прав для создания проекта в этой организации. Переключитесь на организацию покупателя или войдите как buyer@demo.quathub.local."
          : e.message
        : `Не удалось создать проект. Обращение ${ref}. Повторите или откройте «Мои проекты».`;
    redirect(`/app/projects?error=${encodeURIComponent(msg)}`);
  }
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/app/projects");
  const sp = await searchParams;

  const memberships = await listMemberships(session.user.id);
  if (memberships.length === 0) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-xl flex-1 px-[var(--workspace-pad-mobile)] py-10 lg:px-[var(--workspace-pad)]">
          <Panel padding="md">
            <h1 className="text-2xl font-semibold">Нужна организация</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Каталог доступен без организации. Чтобы сохранять сметы — создайте
              организацию покупателя.
            </p>
            <form action={createOrgAction} className="mt-6 flex flex-col gap-3">
              <input
                name="name"
                required
                placeholder="Название организации"
                className="h-11 rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--control)] px-3"
              />
              <button
                type="submit"
                className="rounded-[var(--radius-button)] bg-[var(--brand)] px-4 py-2 font-semibold text-[var(--brand-foreground)]"
              >
                Создать организацию
              </button>
            </form>
            <Link href="/catalog/products" className="mt-4 inline-block text-sm underline">
              В каталог товаров
            </Link>
          </Panel>
        </main>
      </>
    );
  }

  const activeOrgId = await getOrCreateActiveOrganizationId(session.user.id);
  let ctx;
  try {
    ctx = await requireAuthContext(session.user.id);
  } catch {
    redirect("/login");
  }
  const canWrite = can(ctx.role, "project:write");
  const projects = await listProjectsForUser(session.user.id);
  const cities = await prisma.city.findMany({ orderBy: { nameRu: "asc" } });
  const templates = await listTemplates();

  const withEstimates = await Promise.all(
    projects.map(async (p) => {
      const draft = await prisma.estimate.findFirst({
        where: { projectId: p.id, status: "draft" },
        orderBy: { updatedAt: "desc" },
      });
      return { project: p, draft };
    }),
  );

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-[var(--workspace-pad-mobile)] py-8 lg:px-[var(--workspace-pad)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              Мои сметы
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Организация: <strong>{ctx.organization.name}</strong> ({ctx.role})
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/catalog/products" className="text-[var(--accent)] underline">
              Товары
            </Link>
            <Link href="/catalog/services" className="text-[var(--accent)] underline">
              Услуги
            </Link>
            <Link href="/app/import-draft" className="underline text-[var(--muted)]">
              Перенести черновик
            </Link>
          </div>
        </div>

        {memberships.length > 1 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-[var(--muted)]">Сменить организацию:</span>
            {memberships.map((m) =>
              m.organizationId === activeOrgId ? (
                <span key={m.id} className="rounded border border-[var(--accent)] px-2 py-0.5">
                  {m.organization.name}
                </span>
              ) : (
                <form key={m.id} action={switchOrgAction}>
                  <input type="hidden" name="organizationId" value={m.organizationId} />
                  <button type="submit" className="rounded border px-2 py-0.5 underline">
                    {m.organization.name}
                  </button>
                </form>
              ),
            )}
          </div>
        ) : null}

        {sp.error ? (
          <div
            className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"
            role="alert"
          >
            <p>{sp.error}</p>
            <div className="mt-2 flex gap-3">
              <Link href="/app/projects" className="underline">
                К моим проектам
              </Link>
              <Link href="/catalog/products" className="underline">
                В каталог
              </Link>
            </div>
          </div>
        ) : null}

        {canWrite ? (
          <CreateProjectForm
            cities={cities.map((c) => ({ id: c.id, nameRu: c.nameRu }))}
            templates={templates.map((t) => ({ code: t.code, nameRu: t.nameRu }))}
            organizationId={ctx.organizationId}
            action={createProjectAction}
          />
        ) : (
          <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
            <p>
              В активной организации роль <strong>{ctx.role}</strong> не позволяет
              создавать проекты. Каталог и просмотр доступны.
            </p>
            <p className="mt-2 text-[var(--muted)]">
              Для смет войдите как buyer@demo.quathub.local или переключитесь на
              организацию покупателя.
            </p>
            <div className="mt-3 flex gap-3">
              <Link href="/catalog/products" className="underline text-[var(--accent)]">
                Смотреть товары
              </Link>
              <Link href="/catalog/services" className="underline text-[var(--accent)]">
                Смотреть услуги
              </Link>
            </div>
          </div>
        )}

        <ul className="mt-6 divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--panel)]">
          {withEstimates.length === 0 ? (
            <li className="p-6 text-sm text-[var(--muted)]">
              Проектов пока нет.{" "}
              <Link href="/catalog/products" className="underline">
                Выберите товары в каталоге
              </Link>
            </li>
          ) : (
            withEstimates.map(({ project, draft }) => (
              <li
                key={project.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <div className="font-medium">{project.name}</div>
                  <div className="text-sm text-[var(--muted)]">
                    {project.objectName ?? "Объект не указан"}
                  </div>
                </div>
                {draft ? (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/catalog/products?projectId=${project.id}`}
                      className="rounded-md border px-3 py-1.5 text-sm"
                    >
                      + Товары
                    </Link>
                    <Link
                      href={`/catalog/services?projectId=${project.id}`}
                      className="rounded-md border px-3 py-1.5 text-sm"
                    >
                      + Услуги
                    </Link>
                    <Link
                      href={`/app/projects/${project.id}/estimates/${draft.id}`}
                      className="rounded-[var(--radius-button)] bg-[var(--brand)] px-3 py-1.5 text-sm font-semibold text-[var(--brand-foreground)]"
                    >
                      Открыть смету
                    </Link>
                  </div>
                ) : (
                  <span className="text-sm text-[var(--muted)]">Нет черновика</span>
                )}
              </li>
            ))
          )}
        </ul>
      </main>
    </>
  );
}
