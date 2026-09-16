import { describe, expect, it } from "vitest";
import { getBuildInfo, publicBuildInfo } from "@/lib/build-info";

describe("build-info", () => {
  it("returns immutable fields without calling git", () => {
    const b = getBuildInfo();
    expect(b.version).toBeTruthy();
    expect(b.deploymentId).toBeTruthy();
    expect(publicBuildInfo().appVersion).toBe(b.version);
  });
});
