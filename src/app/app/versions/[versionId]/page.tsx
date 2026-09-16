import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import {
  createPublicLinkAction,
  revokePublicLinkAction,
} from "@/app/actions/estimate";
import { auth } from "@/lib/auth";
import {
  getVersionForUser,
  toClientEstimateDto,
  type EstimateSnapshot,
} from "@/modules/estimates/versions";
import type { CalcResult } from "@/modules/pricing";

export default async function VersionPage({
  params,
}: {
  params: Promise<{ versionId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { versionId } = await params;

  let version;
  try {
    version = await getVersionForUser(session.user.id, versionId);
  } catch {
    notFound();
  }

  const snapshot = version.snapshot as unknown as EstimateSnapshot;
  const calc = version.calcResult as unknown as CalcResult;
  const client = toClientEstimateDto(snapshot, calc);

  // Prove internal fields exist in raw snapshot but not in client DTO
  const rawHasPurchase = snapshot.lines.some(
    (l) => l.unitPurchasePrice != null || l.markupPercent != null || l.notesInternal != null,
  );

  async function createLink(formData: FormData) {
    "use server";
    formData.set("versionId", versionId);
    const res = await createPublicLinkAction(formData);
    if (res.ok && res.token) {
      redirect(`/app/versions/${versionId}?created=${res.token}`);
    }
    redirect(`/app/versions/${versionId}`);
  }

  async function revokeLink(formData: FormData) {
    "use server";
    await revokePublicLinkAction(formData);
    redirect(`/app/versions/${versionId}`);
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm text-[var(--muted)]">
          <Link href={`/app/projects/${version.estimate.projectId}/estimates/${version.estimateId}`}>
            ← К черновику
          </Link>
          {" · "}
          <Link
            href={`/app/projects/${version.estimate.projectId}/estimates/${version.estimateId}#versions`}
          >
            К списку версий
          </Link>
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
          Версия {version.versionNumber}
        </h1>
        <p className="text-sm text-[var(--muted)]">
          {version.documentKind} · {version.calculationPolicyVersion} · immutable=
          {String(version.immutable)} · {version.issuedAt.toISOString()}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="font-semibold">Клиентский DTO</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Без закупки, наценки и внутренних заметок
              {rawHasPurchase ? " (в снимке они есть, в DTO — нет)" : ""}.
            </p>
            <pre className="mt-3 max-h-80 overflow-auto rounded bg-[var(--bg)] p-2 text-xs">
              {JSON.stringify(client, null, 2)}
            </pre>
          </section>
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="font-semibold">Итог снимка</h2>
            <p className="mt-2 text-2xl font-semibold">
              {calc.grandTotal ?? calc.knownSubtotal} KZT
            </p>
            <p className="text-sm text-[var(--muted)]">
              complete={String(calc.complete)} · не пересчитывается новой логикой
            </p>

            <h3 className="mt-6 font-semibold">Экспорт</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Из снимка версии. Клиентский без закупки; внутренний помечен.
            </p>
            <div className="mt-2">
              <Link
                href={`/app/versions/${versionId}/requests`}
                className="inline-block rounded-md bg-[var(--accent-2)] px-3 py-1.5 text-sm font-semibold text-white"
              >
                Создать заявки поставщикам
              </Link>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {(["pdf", "xlsx", "docx", "csv"] as const).map((format) => (
                <a
                  key={`c-${format}`}
                  className="rounded-md bg-[var(--accent)] px-3 py-1.5 font-semibold text-white"
                  href={`/api/exports/version/${versionId}?format=${format}&variant=client`}
                >
                  {format.toUpperCase()} клиент
                </a>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {(["pdf", "xlsx", "docx", "csv"] as const).map((format) => (
                <a
                  key={`i-${format}`}
                  className="rounded-md border border-[var(--border)] px-3 py-1.5"
                  href={`/api/exports/version/${versionId}?format=${format}&variant=internal`}
                >
                  {format.toUpperCase()} внутр.
                </a>
              ))}
            </div>

            <h3 className="mt-6 font-semibold">Публичные ссылки</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {version.publicLinks.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-2">
                  <Link className="text-[var(--accent)] underline" href={`/p/${l.token}`}>
                    /p/{l.token.slice(0, 8)}…
                  </Link>
                  {l.revokedAt ? (
                    <span className="text-[var(--danger)]">отозвана</span>
                  ) : (
                    <form action={revokeLink}>
                      <input type="hidden" name="linkId" value={l.id} />
                      <button type="submit" className="underline">
                        Отозвать
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            <form action={createLink} className="mt-3">
              <input type="hidden" name="expiresInDays" value="30" />
              <button
                type="submit"
                className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white"
              >
                Создать ссылку
              </button>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}
