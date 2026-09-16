import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createProjectForUser,
  listProjectsForUser,
} from "@/modules/projects/service";
import { ensureDraftEstimate } from "@/modules/estimates/draft";
import { applyTemplateAction } from "@/app/actions/estimate";
import { listTemplates } from "@/modules/estimates/price-refresh";

async function createProjectAction(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const name = String(formData.get("name") ?? "").trim();
  const cityId = String(formData.get("cityId") ?? "") || undefined;
  const templateCode = String(formData.get("templateCode") ?? "") || undefined;
  if (!name) redirect("/app/projects");
  const project = await createProjectForUser(session.user.id, { name, cityId });
  const estimate = await ensureDraftEstimate(session.user.id, project.id);
  if (templateCode) {
    const fd = new FormData();
    fd.set("projectId", project.id);
    fd.set("templateCode", templateCode);
    await applyTemplateAction(fd);
  }
  redirect(`/app/projects/${project.id}/estimates/${estimate.id}`);
}

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/app/projects");

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
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl">
              Мои проекты
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Проект содержит сметы. Корзина = черновик сметы.
            </p>
          </div>
          <Link
            href="/app/import-draft"
            className="text-sm text-[var(--accent)] underline"
          >
            Перенести локальный черновик
          </Link>
        </div>

        <form
          action={createProjectAction}
          className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
            Название
            <input
              name="name"
              required
              placeholder="Например: Освещение склада"
              className="rounded-md border border-[var(--border)] px-3 py-2"
            />
          </label>
          <label className="flex min-w-[160px] flex-col gap-1 text-sm">
            Город
            <select name="cityId" className="rounded-md border border-[var(--border)] px-3 py-2">
              <option value="">Не выбран</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameRu}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[200px] flex-col gap-1 text-sm">
            Шаблон (опц.)
            <select name="templateCode" className="rounded-md border border-[var(--border)] px-3 py-2">
              <option value="">Без шаблона</option>
              {templates.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.nameRu}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            Создать смету
          </button>
        </form>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Шаблоны учебные — не готовые инженерные проекты.
        </p>

        <ul className="mt-6 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          {withEstimates.length === 0 ? (
            <li className="p-6 text-sm text-[var(--muted)]">Проектов пока нет.</li>
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
                  <Link
                    href={`/app/projects/${project.id}/estimates/${draft.id}`}
                    className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    Открыть смету
                  </Link>
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
