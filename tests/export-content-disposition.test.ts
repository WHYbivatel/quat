import { describe, expect, it } from "vitest";
import { contentDispositionAttachment } from "@/modules/exports/http";

describe("contentDispositionAttachment", () => {
  it("keeps ASCII filenames as ByteString-safe", () => {
    const v = contentDispositionAttachment("estimate-draft-r5_client.pdf");
    expect(v).toContain('filename="estimate-draft-r5_client.pdf"');
    expect(v).toContain("filename*=UTF-8''estimate-draft-r5_client.pdf");
  });

  it("does not put Cyrillic into the filename= token", () => {
    const v = contentDispositionAttachment("СМ-001_draft-r8_internal.pdf");
    const asciiPart = v.match(/filename="([^"]+)"/)?.[1] ?? "";
    expect([...asciiPart].every((ch) => ch.charCodeAt(0) < 256)).toBe(true);
    expect(asciiPart).not.toMatch(/[А-Яа-яЁё]/);
    expect(v).toContain("filename*=UTF-8''");
    expect(v).toContain(encodeURIComponent("СМ-001_draft-r8_internal.pdf"));
    // Simulate Headers ByteString constraint
    expect(() => new Headers({ "Content-Disposition": v })).not.toThrow();
  });
});
