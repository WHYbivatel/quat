"use client";

import { useEffect, useRef, useState } from "react";

type VersionPayload = {
  deploymentId: string;
  appVersion: string;
};

const POLL_MS = 60_000;

export function DeploymentWatcher() {
  const initialId = useRef<string | null>(null);
  const [banner, setBanner] = useState(false);
  const reloading = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as VersionPayload;
        if (cancelled || !data.deploymentId) return;
        if (!initialId.current) {
          initialId.current = data.deploymentId;
          return;
        }
        if (data.deploymentId !== initialId.current) {
          setBanner(true);
        }
      } catch {
        /* offline */
      }
    }

    void check();
    const id = window.setInterval(check, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    const onChunkError = (event: ErrorEvent) => {
      const msg = String(event.message || "");
      if (
        !reloading.current &&
        /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module/i.test(
          msg,
        )
      ) {
        reloading.current = true;
        window.location.reload();
      }
    };
    window.addEventListener("error", onChunkError);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("error", onChunkError);
    };
  }, []);

  if (!banner) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm shadow-lg"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <p>Доступна новая версия приложения. Сохраните черновик перед обновлением.</p>
        <button
          type="button"
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white"
          onClick={() => window.location.reload()}
        >
          Обновить
        </button>
      </div>
    </div>
  );
}
