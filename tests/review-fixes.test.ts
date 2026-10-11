import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type DB } from "@/db";
import { operation, organization, user } from "@/db/schema";
import { countInput, newProductInput, productInput, reorderRuleInput } from "@/lib/validation";
import { createCategory, createProduct, deleteCategory, listProducts, listSizes, setProductActive, updateProduct } from "@/server/catalog";
import { archiveLocation, createLocation, ensureWorkspaceSetup, listInternalLocations } from "@/server/locations";
import { familyStock, replenishmentReport, upsertReorderRule } from "@/server/reports";
import { adjustStock, applyCount, createOperation, transferStock } from "@/server/stock";

// Regression tests for findings confirmed in the jury review (see workflow/STATE.md).

let db: DB;
const ORG = "org-r";
const USER = "user-r";
let stockLoc: string;
let shelf: string;
const base = {
  variant: null, familyId: null, categoryId: null, sku: null, barcode: null, uom: "pcs",
  cost: null, salePrice: null, description: null, initialQuantity: 0, initialLocationId: null,
};

beforeAll(async () => {
  db = createDb("");
  await migrate(db as never, { migrationsFolder: "drizzle", migrationsSchema: "inventory" });
  await db.insert(user).values({ id: USER, name: "R", email: "r@example.com" });
  await db.insert(organization).values({ id: ORG, name: "R", slug: "r" });
  await ensureWorkspaceSetup(db, ORG);
  stockLoc = (await listInternalLocations(db, ORG))[0].id;
  shelf = (await createLocation(db, ORG, { parentId: stockLoc, name: "Shelf", barcode: null })).id;
});

describe("save & validate is atomic", () => {
  it("leaves no orphan draft when validation fails", async () => {
    const p = await createProduct(db, ORG, USER, { ...base, name: "Bolt", initialQuantity: 3, initialLocationId: stockLoc });
    const before = await db.select().from(operation).where(eq(operation.organizationId, ORG));
    await expect(
      createOperation(
        db, ORG, USER,
        { type: "delivery", sourceLocationId: stockLoc, destLocationId: null, partner: null, note: null, lines: [{ productId: p.id, quantity: 10 }] },
        { validateNow: true },
      ),
    ).rejects.toThrow(/Not enough/);
    const after = await db.select().from(operation).where(eq(operation.organizationId, ORG));
    expect(after).toHaveLength(before.length);

    const ok = await createOperation(
      db, ORG, USER,
      { type: "delivery", sourceLocationId: stockLoc, destLocationId: null, partner: null, note: null, lines: [{ productId: p.id, quantity: 2 }] },
      { validateNow: true },
    );
    const [saved] = await db.select().from(operation).where(eq(operation.id, ok.id));
    expect(saved.state).toBe("done");
    // The failed attempt did not burn a reference number.
    expect(Number(ok.reference.split("/")[1])).toBe(1);
  });
});

describe("one item per name", () => {
  it("adds a size to the existing item instead of creating a second item", async () => {
    const cat = await createCategory(db, ORG, { name: "Wheels", parentId: null, color: "#112233", description: null });
    const first = await createProduct(db, ORG, USER, { ...base, name: "Tire", variant: "15 inch", categoryId: cat.id, uom: "set" });
    const second = await createProduct(db, ORG, USER, { ...base, name: "tire", variant: "18 inch", uom: "pcs" });
    expect(second.familyId).toBe(first.familyId);
    expect(second.name).toBe("Tire");
    // Shared fields come from the item, not from the new form.
    expect([second.uom, second.categoryId]).toEqual(["set", cat.id]);
    expect(await listSizes(db, ORG, first.familyId)).toHaveLength(2);
  });

  it("asks for a size when the name already exists", async () => {
    await expect(createProduct(db, ORG, USER, { ...base, name: "Tire" })).rejects.toThrow(/Enter a size/);
  });

  it("refuses to rename an item onto another item's name", async () => {
    const [bolt] = await listProducts(db, ORG, { q: "Bolt" });
    await expect(
      updateProduct(db, ORG, bolt.id, {
        name: "TIRE", variant: null, categoryId: null, sku: null, barcode: null, uom: "pcs", cost: null, salePrice: null, description: null,
      }),
    ).rejects.toThrow(/already called/);
  });
});

describe("archiving", () => {
  it("refuses to archive a size that still has stock, and hides archived sizes from the item total", async () => {
    const [bolt] = await listProducts(db, ORG, { q: "Bolt" });
    await expect(setProductActive(db, ORG, bolt.id, false)).rejects.toThrow(/still has stock/);
    await adjustStock(db, ORG, USER, {
      direction: "subtract", productId: bolt.id, locationId: stockLoc, amount: 1, reason: "use", partner: null, note: null,
    });
    await setProductActive(db, ORG, bolt.id, false);
    expect(await familyStock(db, ORG, bolt.familyId)).toHaveLength(0);
    await setProductActive(db, ORG, bolt.id, true);
  });

  it("never archives the last location, and rejects archived parents", async () => {
    await archiveLocation(db, ORG, shelf);
    await expect(archiveLocation(db, ORG, stockLoc)).rejects.toThrow(/last location/);
    await expect(createLocation(db, ORG, { parentId: shelf, name: "Bin", barcode: null })).rejects.toThrow(/parent/);
  });
});

describe("edge cases that used to surface as a generic error", () => {
  it("returns an empty list for an unknown location filter", async () => {
    expect(await listProducts(db, ORG, { locationId: "not-a-location" })).toEqual([]);
  });

  it("explains why a category cannot be deleted when a child would clash one level up", async () => {
    const a = await createCategory(db, ORG, { name: "A", parentId: null, color: "#112233", description: null });
    await createCategory(db, ORG, { name: "X", parentId: a.id, color: "#112233", description: null });
    await createCategory(db, ORG, { name: "X", parentId: null, color: "#112233", description: null });
    await expect(deleteCategory(db, ORG, a.id)).rejects.toThrow(/same name/);
  });

  it("keeps a count correct after a concurrent-style change and ignores 0/0 reorder rules", async () => {
    const p = await createProduct(db, ORG, USER, { ...base, name: "Nut", initialQuantity: 10, initialLocationId: stockLoc });
    const second = (await createLocation(db, ORG, { parentId: stockLoc, name: "Shelf 2", barcode: null })).id;
    await Promise.all([
      transferStock(db, ORG, USER, { productId: p.id, fromLocationId: stockLoc, toLocationId: second, amount: 2, note: null }),
      applyCount(db, ORG, USER, { productId: p.id, locationId: stockLoc, countedQuantity: 7, note: null }),
    ]);
    const rows = await familyStock(db, ORG, p.familyId);
    // Whatever the order, the two results are the only consistent outcomes.
    const here = rows.find((r) => r.locationId === stockLoc)!.quantity;
    expect([5, 7]).toContain(here);
    expect(rows.find((r) => r.locationId === second)!.quantity).toBe(2);

    await upsertReorderRule(db, ORG, { productId: p.id, locationId: second, minQuantity: 0, maxQuantity: 0 });
    expect((await replenishmentReport(db, ORG)).find((r) => r.productId === p.id)).toBeUndefined();
  });
});

describe("input validation", () => {
  it("rejects empty number fields instead of treating them as 0", () => {
    expect(countInput.safeParse({ productId: "p", locationId: "l", countedQuantity: "" }).success).toBe(false);
    expect(reorderRuleInput.safeParse({ productId: "p", locationId: "l", minQuantity: "", maxQuantity: "5" }).success).toBe(false);
    expect(countInput.parse({ productId: "p", locationId: "l", countedQuantity: "0" }).countedQuantity).toBe(0);
    // Opening stock is optional and defaults to 0.
    expect(newProductInput.parse({ name: "Z", uom: "pcs", initialQuantity: "" }).initialQuantity).toBe(0);
  });

  it("caps prices at what the cents column can hold", () => {
    expect(productInput.safeParse({ name: "Z", uom: "pcs", salePrice: "21000000" }).success).toBe(true);
    expect(productInput.safeParse({ name: "Z", uom: "pcs", salePrice: "21000001" }).success).toBe(false);
  });
});
