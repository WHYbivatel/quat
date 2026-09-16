import { auth } from "@/lib/auth";
import { requirePlatformAdmin } from "@/modules/organizations/access";
import { buildTemplateCsv } from "@/modules/administration/import-parse";
import { AccessDeniedError } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    await requirePlatformAdmin(session.user.id);
  } catch (e) {
    if (e instanceof AccessDeniedError) {
      return new Response("Forbidden", { status: 403 });
    }
    throw e;
  }
  const csv = buildTemplateCsv();
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="quathub-price-template.csv"',
    },
  });
}
