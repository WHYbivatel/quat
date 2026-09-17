import Link from "next/link";
import { auth } from "@/lib/auth";
import { getOrCreateActiveOrganizationId, listMemberships } from "@/modules/organizations/access";
import { AccountMenu } from "@/components/AccountMenu";
import { AppNav } from "@/components/AppNav";

/** App chrome header — slightly lifted surface on page gray */
export async function SiteHeader() {
  const session = await auth();
  let orgName: string | null = null;
  let isAdmin = false;
  let isSupplier = false;
  if (session?.user?.id) {
    try {
      const memberships = await listMemberships(session.user.id);
      const activeId = await getOrCreateActiveOrganizationId(session.user.id);
      const active = memberships.find((m) => m.organizationId === activeId);
      orgName = active?.organization.name ?? null;
      isAdmin = memberships.some((m) => m.role === "platform_admin");
      isSupplier = memberships.some((m) => m.role === "supplier_manager");
    } catch {
      /* ignore */
    }
  }

  const accountLinks: { href: string; label: string }[] = [];
  if (session?.user) {
    accountLinks.push({ href: "/app/requests", label: "Заявки" });
    if (isSupplier) {
      accountLinks.push({ href: "/app/supplier/offers", label: "Кабинет поставщика" });
      accountLinks.push({ href: "/app/supplier/requests", label: "Входящие заявки" });
    }
    if (isAdmin) {
      accountLinks.push({ href: "/app/admin", label: "Админ" });
      accountLinks.push({ href: "/capabilities", label: "Возможности стенда" });
    }
  }

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-[#CED2C8] bg-[#ECEDE9] shadow-none">
      <div className="mx-auto flex h-full w-full items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/catalog/products" className="shrink-0 text-base font-semibold tracking-tight text-[var(--text-primary)]">
            QuatHub
          </Link>
          <AppNav />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {session?.user ? (
            <AccountMenu
              email={session.user.email ?? "Аккаунт"}
              orgName={orgName}
              links={accountLinks}
            />
          ) : (
            <Link
              href="/login?next=/catalog/products"
              className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-button)] bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--brand-foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
              Войти
            </Link>
          )}
        </div>
      </div>
      <AppNav mobile />
    </header>
  );
}

/** Alias for UI kit / docs */
export const AppHeader = SiteHeader;
