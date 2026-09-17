import Link from "next/link";
import { getBuildInfo } from "@/lib/build-info";

export function SiteFooter() {
  const build = getBuildInfo();
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--page)]">
      <div className="mx-auto flex w-full flex-wrap items-center justify-between gap-2 px-[var(--workspace-pad-mobile)] py-4 text-xs text-[var(--text-secondary)] lg:px-[var(--workspace-pad)]">
        <p>
          QuatHub · коммерческие сметы ·{" "}
          <Link href="/api/version" className="underline hover:text-[var(--text-primary)]">
            v{build.version}
          </Link>
        </p>
        <p className="font-mono">
          {build.gitShaShort} · {build.deploymentId.slice(0, 24)}
        </p>
      </div>
    </footer>
  );
}
