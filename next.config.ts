import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type BuildInfo = {
  version: string;
  gitSha: string;
  gitShaShort: string;
  buildTime: string;
  deploymentId: string;
};

function loadBuildInfo(): BuildInfo {
  try {
    return JSON.parse(
      readFileSync(resolve(__dirname, "build-info.json"), "utf8"),
    ) as BuildInfo;
  } catch {
    return {
      version: "0.2.0",
      gitSha: "dev",
      gitShaShort: "dev",
      buildTime: new Date().toISOString(),
      deploymentId: "dev-local",
    };
  }
}

const build = loadBuildInfo();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: build.version,
    NEXT_PUBLIC_GIT_SHA: build.gitShaShort,
    NEXT_PUBLIC_BUILD_TIME: build.buildTime,
    NEXT_PUBLIC_DEPLOYMENT_ID: build.deploymentId,
  },
  async headers() {
    return [
      {
        source: "/app/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      {
        source: "/login",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      {
        source: "/api/auth/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      {
        source: "/api/exports/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      {
        source: "/api/version",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/api/health/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
