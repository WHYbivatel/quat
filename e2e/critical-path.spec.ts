import { expect, test } from "@playwright/test";

const buyerEmail = process.env.E2E_BUYER_EMAIL || "buyer@demo.quathub.local";
const buyerPassword = process.env.E2E_BUYER_PASSWORD || "Demo1234!";

test.describe("critical path MVP", () => {
  test("catalog → login → projects → public services → logout", async ({
    page,
  }) => {
    await page.goto("/catalog/products");
    await expect(page.getByRole("heading", { name: /товар/i })).toBeVisible();

    await page.goto("/catalog/services");
    await expect(page.getByRole("heading", { name: /услуг/i })).toBeVisible();
    // Public curated sources from 7A should appear after seed/publish
    const body = await page.locator("main").innerText();
    expect(body.length).toBeGreaterThan(40);

    await page.goto("/login?next=/app/projects");
    await page.getByLabel(/email/i).fill(buyerEmail);
    await page.getByLabel(/пароль/i).fill(buyerPassword);
    await page.getByRole("button", { name: /войти/i }).click();
    await page.waitForURL((url) => url.pathname.startsWith("/app/projects"), {
      timeout: 30_000,
    });

    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("link", { name: /товар/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /услуг/i }).first()).toBeVisible();

    // Login return path preserves next=
    await page.goto("/login?next=/catalog/services");
    await expect(page.getByText(/уже вошли/i)).toBeVisible();
    await page.getByRole("link", { name: /продолжить/i }).click();
    await page.waitForURL((url) => url.pathname.startsWith("/catalog/services"));

    await page.goto("/login");
    await page.getByRole("button", { name: /выйти/i }).click();
    await page.waitForURL((url) => url.pathname === "/");
    await page.goto("/app/projects");
    await page.waitForURL((url) => url.pathname.startsWith("/login"));
  });

  test("guest can open login and return to catalog", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /в каталог/i }).click();
    await page.waitForURL((url) => url.pathname.startsWith("/catalog/"));
  });

  test("version and health endpoints", async ({ request }) => {
    const live = await request.get("/api/health/live");
    expect(live.ok()).toBeTruthy();
    const ready = await request.get("/api/health/ready");
    expect(ready.ok()).toBeTruthy();
    const version = await request.get("/api/version");
    expect(version.ok()).toBeTruthy();
    const json = await version.json();
    expect(json.appVersion).toBeTruthy();
    expect(json.deploymentId).toBeTruthy();
    expect(json.calculationPolicyVersion).toBe("commercial-v1");
  });

  test("guest draft has continue CTA", async ({ page }) => {
    await page.goto("/draft");
    await expect(page.getByRole("heading", { name: /локальный черновик/i })).toBeVisible();
    const continueBtn = page.getByRole("link", {
      name: /войти и продолжить|продолжить в редакторе|выбрать товары/i,
    });
    await expect(continueBtn.first()).toBeVisible();
  });
});
