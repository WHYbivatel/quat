import { auth } from "@/lib/auth";
import { listProjectsForUser } from "@/modules/projects/service";
import { listMemberships } from "@/modules/organizations/access";
import { GuestDraftClient } from "./GuestDraftClient";

export default async function GuestDraftPage() {
  const session = await auth();
  let projects: { id: string; name: string }[] = [];
  let hasOrg = false;
  if (session?.user?.id) {
    try {
      const memberships = await listMemberships(session.user.id);
      hasOrg = memberships.length > 0;
      projects = (await listProjectsForUser(session.user.id)).map((p) => ({
        id: p.id,
        name: p.name,
      }));
    } catch {
      projects = [];
    }
  }

  return (
    <GuestDraftClient
      isAuthenticated={Boolean(session?.user)}
      hasOrg={hasOrg}
      projects={projects}
      userEmail={session?.user?.email ?? null}
    />
  );
}
