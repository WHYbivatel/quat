import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { searchCatalogItems } from "@/modules/catalog/queries";

const prisma = new PrismaClient();

describe("catalog search filters", () => {
  beforeAll(async () => {
    const count = await prisma.catalogItem.count();
    expect(count).toBeGreaterThan(0);
  });

  it("filters products by category slug", async () => {
    const all = await searchCatalogItems({ kind: "product", pageSize: 50 });
    const cable = await searchCatalogItems({
      kind: "product",
      category: "cable",
      pageSize: 50,
    });
    expect(cable.total).toBeGreaterThan(0);
    expect(cable.total).toBeLessThanOrEqual(all.total);
    expect(cable.items.every((i) => i.category.slug === "cable")).toBe(true);
  });

  it("filters cable by conductor material via URL-like params", async () => {
    const cu = await searchCatalogItems({
      kind: "product",
      category: "cable",
      conductor_material: "Cu",
      pageSize: 50,
    });
    expect(cu.total).toBeGreaterThan(0);
    for (const item of cu.items) {
      const mat = item.attributes.find(
        (a) => a.attributeDefinition.code === "conductor_material",
      );
      expect(mat?.value).toBe("Cu");
    }
  });

  it("filters by text query on name/sku", async () => {
    const res = await searchCatalogItems({
      kind: "product",
      q: "ВВГнг",
      pageSize: 20,
    });
    expect(res.total).toBeGreaterThan(0);
    expect(
      res.items.every(
        (i) =>
          i.name.toLowerCase().includes("ввгнг") ||
          (i.sku ?? "").toLowerCase().includes("vvg"),
      ),
    ).toBe(true);
  });

  it("returns services separately", async () => {
    const services = await searchCatalogItems({ kind: "service", pageSize: 50 });
    expect(services.total).toBeGreaterThanOrEqual(15);
    expect(services.items.every((i) => i.kind === "service")).toBe(true);
  });

  it("paginates server-side", async () => {
    const page1 = await searchCatalogItems({
      kind: "product",
      page: 1,
      pageSize: 5,
    });
    const page2 = await searchCatalogItems({
      kind: "product",
      page: 2,
      pageSize: 5,
    });
    expect(page1.items).toHaveLength(5);
    expect(page2.items.length).toBeGreaterThan(0);
    const ids1 = new Set(page1.items.map((i) => i.id));
    expect(page2.items.every((i) => !ids1.has(i.id))).toBe(true);
  });
});
