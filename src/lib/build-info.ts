import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type BuildInfo = {
  version: string;
  gitSha: string;
  gitShaShort: string;
  buildTime: string;
  deploymentId: string;
};

const FALLBACK: BuildInfo = {
  version: process.env.APP_VERSION || "0.2.0",
  gitSha: process.env.GIT_SHA || "dev",
  gitShaShort: (process.env.GIT_SHA || "dev").slice(0, 12),
  buildTime: process.env.BUILD_TIME || "1970-01-01T00:00:00.000Z",
  deploymentId: process.env.DEPLOYMENT_ID || "dev-local",
};

function readBuildInfoFile(): BuildInfo | null {
  try {
    const raw = readFileSync(resolve(process.cwd(), "build-info.json"), "utf8");
    const parsed = JSON.parse(raw) as Partial<BuildInfo>;
    if (!parsed.version || !parsed.deploymentId) return null;
    return {
      version: parsed.version,
      gitSha: parsed.gitSha || FALLBACK.gitSha,
      gitShaShort: parsed.gitShaShort || (parsed.gitSha || "").slice(0, 12) || "dev",
      buildTime: parsed.buildTime || FALLBACK.buildTime,
      deploymentId: parsed.deploymentId,
    };
  } catch {
    return null;
  }
}

/** Immutable for a given build — do not call git at runtime. */
export function getBuildInfo(): BuildInfo {
  return readBuildInfoFile() ?? FALLBACK;
}

export function publicBuildInfo() {
  const b = getBuildInfo();
  return {
    appVersion: b.version,
    gitSha: b.gitShaShort,
    buildTime: b.buildTime,
    deploymentId: b.deploymentId,
  };
}
