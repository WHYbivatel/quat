import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { listProjectsForUser } from "@/modules/projects/service";
import ImportDraftClient from "./ImportDraftClient";

export default async function ImportDraftPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/app/import-draft");
  const projects = await listProjectsForUser(session.user.id);

  return (
    <>
      <SiteHeader />
      <ImportDraftClient
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      />
    </>
  );
}
