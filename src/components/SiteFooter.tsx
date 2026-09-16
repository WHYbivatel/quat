import Link from "next/link";
import { getBuildInfo } from "@/lib/build-info";

export function SiteFooter() {
  const build = getBuildInfo();
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--surface)]/60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-[var(--muted)]">
        <p>
          QuatHub · коммерческие сметы ·{" "}
          <Link href="/api/version" className="underline hover:text-[var(--fg)]">
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
