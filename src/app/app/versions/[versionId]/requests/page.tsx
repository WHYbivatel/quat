import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { RequestComposer } from "@/components/RequestComposer";
import { auth } from "@/lib/auth";
import { previewRequestsFromVersion } from "@/modules/requests/service";

export default async function CreateRequestsPage({
  params,
}: {
  params: Promise<{ versionId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { versionId } = await params;

  let preview;
  try {
    preview = await previewRequestsFromVersion(session.user.id, versionId);
  } catch {
    notFound();
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-[var(--muted)]">
          <Link href={`/app/versions/${versionId}`}>← К версии</Link>
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
          Заявки поставщикам
        </h1>
        <div className="mt-6">
          <RequestComposer
            versionId={versionId}
            groups={preview.groups}
            unassigned={preview.unassigned}
          />
        </div>
      </main>
    </>
  );
}
