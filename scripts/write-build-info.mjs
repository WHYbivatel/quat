#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

function git(cmd) {
  try {
    return execSync(cmd, { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

const version = process.env.APP_VERSION || pkg.version;
const gitSha =
  process.env.GIT_SHA || git("git rev-parse HEAD") || "unknown";
const gitShaShort = gitSha === "unknown" ? "unknown" : gitSha.slice(0, 12);
const buildTime = process.env.BUILD_TIME || new Date().toISOString();
const deploymentId =
  process.env.DEPLOYMENT_ID || `${gitShaShort}-${buildTime.replace(/[:.]/g, "")}`;

const info = {
  version,
  gitSha,
  gitShaShort,
  buildTime,
  deploymentId,
};

writeFileSync(resolve(root, "build-info.json"), `${JSON.stringify(info, null, 2)}\n`);
console.log(`build-info: ${version} ${gitShaShort} ${deploymentId}`);
