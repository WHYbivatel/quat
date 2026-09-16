import { describe, expect, it } from "vitest";
import {
  FEATURES,
  FeatureStatus,
  isActionable,
  listFeatures,
  publicFeatureSummary,
} from "@/modules/features/registry";
import { assertFeatureActionable, FeatureUnavailableError } from "@/modules/features/assert";

describe("feature availability registry", () => {
  it("has stable ids and known statuses", () => {
    const features = listFeatures();
    expect(features.length).toBeGreaterThan(10);
    for (const f of features) {
      expect(f.id).toBeTruthy();
      expect(Object.values(FeatureStatus)).toContain(f.status);
      expect(FEATURES[f.id]).toEqual(f);
    }
  });

  it("marks core MVP paths as actionable", () => {
    for (const id of [
      "auth.login",
      "catalog.browse",
      "draft.local",
      "estimate.issue",
      "estimate.export_draft_pdf",
      "estimate.export_version",
    ] as const) {
      expect(isActionable(FEATURES[id].status)).toBe(true);
    }
  });

  it("blocks coming-soon actions on server", () => {
    expect(() => assertFeatureActionable("normative.kz")).toThrow(
      FeatureUnavailableError,
    );
    expect(() => assertFeatureActionable("catalog.auto_sync")).toThrow(
      FeatureUnavailableError,
    );
    expect(() => assertFeatureActionable("auth.login")).not.toThrow();
  });

  it("public summary omits evidence internals shape safely", () => {
    const summary = publicFeatureSummary();
    expect(summary[0]).toHaveProperty("id");
    expect(summary[0]).toHaveProperty("status");
    expect(summary[0]).not.toHaveProperty("evidence");
  });
});
