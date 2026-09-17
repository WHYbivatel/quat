"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/** Single source of truth: viewport ≥ 1000px = desktop workspace */
export const QH_DESKTOP_MQ = "(min-width: 1000px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QH_DESKTOP_MQ);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(QH_DESKTOP_MQ).matches;
}

/** SSR + first paint default to desktop so wide screens never flash mobile chrome */
function getServerSnapshot() {
  return true;
}

export function useIsDesktopViewport() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Optional mount gate after hydration for effects that need client-only */
export function useHasMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
