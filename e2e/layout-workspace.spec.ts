import { expect, test, type Page } from "@playwright/test";

async function workspaceMetrics(page: Page) {
  return page.evaluate(() => {
    const ws = document.querySelector(".qh-workspace");
    const main = document.querySelector(".qh-workspace > main");
    const aside = document.querySelector('[data-testid="estimate-desktop"]');
    const mobile = document.querySelector('[data-testid="estimate-mobile-bar"]');
    const panel = document.querySelector('[data-testid="catalog-panel"]');
    if (!ws || !main) return null;
    const wcs = getComputedStyle(ws);
    const mb = main.getBoundingClientRect();
    const ab = aside?.getBoundingClientRect();
    const pb = panel?.getBoundingClientRect();
    return {
      vw: window.innerWidth,
      wsDisplay: wcs.display,
      wsCols: wcs.gridTemplateColumns,
      wsGap: wcs.gap,
      wsPad: wcs.padding,
      asideExists: Boolean(aside),
      asideDisplay: aside ? getComputedStyle(aside).display : "missing",
      asideWidth: ab?.width ?? 0,
      mobileExists: Boolean(mobile),
      mobileDisplay: mobile ? getComputedStyle(mobile).display : "missing",
      colGap: ab && ab.width > 0 ? Math.round(ab.left - mb.right) : 0,
      panelRadius: panel ? getComputedStyle(panel).borderRadius : "",
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      topsAlign:
        ab && ab.width > 0
          ? Math.round(mb.top) === Math.round(ab.top)
          : false,
      downloadVisible: (() => {
        const btn = [...document.querySelectorAll("button")].find((b) =>
          (b.textContent || "").includes("Скачать"),
        );
        if (!btn || !aside || getComputedStyle(aside).display === "none") return false;
        const r = btn.getBoundingClientRect();
        return r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight + 1;
      })(),
      outerPad: pb ? Math.round(pb.left) : 0,
    };
  });
}

test.describe("catalog workspace layout", () => {
  test("desktop 1440: two columns, no mobile bar, gap 24", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/catalog/products");
    await expect(page.getByText(/найдено/i).first()).toBeVisible();

    const m = await workspaceMetrics(page);
    expect(m).not.toBeNull();
    expect(m!.asideExists).toBe(true);
    expect(m!.asideDisplay).not.toBe("none");
    expect(m!.asideWidth).toBeGreaterThan(300);
    expect(m!.mobileDisplay === "none" || m!.mobileExists === false).toBe(true);
    expect(m!.colGap).toBe(24);
    expect(m!.wsPad).toContain("24px");
    expect(m!.topsAlign).toBe(true);
    expect(m!.downloadVisible).toBe(true);
    expect(m!.overflowX).toBe(false);
    expect(m!.outerPad).toBe(24);
    expect(parseFloat(m!.panelRadius)).toBeGreaterThanOrEqual(14);
  });

  test("desktop 1920: two columns, estimate visible", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/catalog/products");
    await expect(page.getByTestId("estimate-desktop")).toBeVisible();
    await expect(page.getByTestId("estimate-mobile-bar")).toHaveCount(0);
    const m = await workspaceMetrics(page);
    expect(m!.colGap).toBe(24);
    expect(m!.downloadVisible).toBe(true);
    expect(m!.overflowX).toBe(false);
  });

  test("desktop 1024: two compact columns", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/catalog/products");
    await expect(page.getByTestId("estimate-desktop")).toBeVisible();
    await expect(page.getByTestId("estimate-mobile-bar")).toHaveCount(0);
    const m = await workspaceMetrics(page);
    expect(m!.asideWidth).toBeGreaterThan(200);
    expect(m!.colGap).toBe(24);
    expect(m!.overflowX).toBe(false);
  });

  test("tablet 768: mobile chrome, no desktop estimate", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/catalog/products");
    await expect(page.getByTestId("estimate-desktop")).toHaveCount(0);
    await expect(page.getByTestId("estimate-mobile-bar")).toBeVisible();
    const m = await workspaceMetrics(page);
    expect(m!.overflowX).toBe(false);
  });

  test("mobile 390: mobile bar opens sheet", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/catalog/products");
    await expect(page.getByTestId("estimate-desktop")).toHaveCount(0);
    const bar = page.getByTestId("estimate-mobile-bar");
    await expect(bar).toBeVisible();
    await bar.getByRole("button").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const m = await workspaceMetrics(page);
    expect(m!.overflowX).toBe(false);
  });
});
