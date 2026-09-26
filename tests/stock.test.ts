import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type DB } from "@/db";
import { location, organization, user } from "@/db/schema";
import { createCategory, createProduct, listProducts, setProductActive } from "@/server/catalog";
import { AppError } from "@/server/common";
import { createLocation, ensureWorkspaceSetup, listInternalLocations } from "@/server/locations";
import { dashboardStats, listMoves, productStockByLocation, replenishmentReport, upsertReorderRule } from "@/server/reports";
import { adjustStock, applyCount, cancelOperation, createOperation, transferStock, validateOperation } from "@/server/stock";
import { eq } from "drizzle-orm";

let db: DB;
const ORG_A = "org-a";
const ORG_B = "org-b";
const USER = "user-1";
let shelfA: string;
let shelfB: string;
let otherOrgLoc: string;

async function stockAt(productId: string, locationId: string) {
  const rows = await productStockByLocation(db, ORG_A, productId);
  return rows.find((r) => r.locationId === locationId)?.quantity ?? 0;
}

beforeAll(async () => {
  db = createDb(""); // empty url -> in-memory PGlite when PGLITE_DATA_DIR=memory
  await migrate(db as never, { migrationsFolder: "drizzle", migrationsSchema: "inventory" });
  await db.insert(user).values({ id: USER, name: "Tester", email: "t@example.com" });
  await db.insert(organization).values([
    { id: ORG_A, name: "A", slug: "a" },
    { id: ORG_B, name: "B", slug: "b" },
  ]);
  await ensureWorkspaceSetup(db, ORG_A);
  await ensureWorkspaceSetup(db, ORG_A); // idempotent
  await ensureWorkspaceSetup(db, ORG_B);

  const stock = (await listInternalLocations(db, ORG_A)).find((l) => l.fullName === "WH/Stock")!;
  shelfA = (await createLocation(db, ORG_A, { parentId: stock.id, name: "Shelf A", barcode: null })).id;
  shelfB = (await createLocation(db, ORG_A, { parentId: stock.id, name: "Shelf B", barcode: null })).id;
  otherOrgLoc = (await listInternalLocations(db, ORG_B))[0].id;
});

describe("workspace setup", () => {
  it("creates one default warehouse and the virtual locations", async () => {
    const locs = await db.select().from(location).where(eq(location.organizationId, ORG_A));
    expect(locs.filter((l) => l.systemKey).map((l) => l.systemKey).sort()).toEqual(
      ["customer", "inventory", "scrap", "vendor"],
    );
    expect(locs.filter((l) => l.type === "view")).toHaveLength(1);
  });
});

describe("stock engine", () => {
  it("records opening stock, add and subtract as double-entry moves", async () => {
    const cat = await createCategory(db, ORG_A, { name: "Tools", parentId: null, color: "#112233", description: null });
    const p = await createProduct(db, ORG_A, USER, {
      name: "Hammer",
      variant: null,
      categoryId: cat.id,
      sku: "HAM-1",
      barcode: null,
      uom: "pcs",
      cost: 500,
      salePrice: 900,
      description: null,
      initialQuantity: 10,
      initialLocationId: shelfA,
    });
    expect(await stockAt(p.id, shelfA)).toBe(10);

    await adjustStock(db, ORG_A, USER, {
      direction: "add", productId: p.id, locationId: shelfA, amount: 5, reason: "restock", partner: "ACME", note: null,
    });
    await adjustStock(db, ORG_A, USER, {
      direction: "subtract", productId: p.id, locationId: shelfA, amount: 3, reason: "sale", partner: null, note: null,
    });
    expect(await stockAt(p.id, shelfA)).toBe(12);

    const moves = await listMoves(db, ORG_A, { productId: p.id });
    expect(moves).toHaveLength(3);
    expect(moves.map((m) => m.operationType).sort()).toEqual(["adjustment", "delivery", "receipt"]);
    expect(moves.find((m) => m.operationType === "receipt")?.reference).toMatch(/^IN\/\d{5}$/);
  });

  it("never lets stock go negative", async () => {
    const [p] = await listProducts(db, ORG_A, { q: "HAM-1" });
    await expect(
      adjustStock(db, ORG_A, USER, {
        direction: "subtract", productId: p.id, locationId: shelfA, amount: 999, reason: "sale", partner: null, note: null,
      }),
    ).rejects.toThrow(/Not enough/);
    expect(await stockAt(p.id, shelfA)).toBe(12);
  });

  it("serializes concurrent subtractions without overselling", async () => {
    const [p] = await listProducts(db, ORG_A, { q: "HAM-1" });
    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        adjustStock(db, ORG_A, USER, {
          direction: "subtract", productId: p.id, locationId: shelfA, amount: 4, reason: "use", partner: null, note: null,
        }),
      ),
    );
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(3);
    expect(await stockAt(p.id, shelfA)).toBe(0);
  });

  it("transfers between sections and supports decimal quantities", async () => {
    const p = await createProduct(db, ORG_A, USER, {
      name: "Rope", variant: null, categoryId: null, sku: null, barcode: "1234567890123", uom: "m", cost: null, salePrice: null,
      description: null, initialQuantity: 7.5, initialLocationId: shelfA,
    });
    await transferStock(db, ORG_A, USER, { productId: p.id, fromLocationId: shelfA, toLocationId: shelfB, amount: 2.25, note: null });
    expect(await stockAt(p.id, shelfA)).toBe(5.25);
    expect(await stockAt(p.id, shelfB)).toBe(2.25);
    const [total] = await listProducts(db, ORG_A, { q: "Rope" });
    expect(total.onHand).toBe(7.5);
  });

  it("applies physical counts as adjustments", async () => {
    const [p] = await listProducts(db, ORG_A, { q: "Rope" });
    const op = await applyCount(db, ORG_A, USER, { productId: p.id, locationId: shelfB, countedQuantity: 3, note: null });
    expect(op?.reference).toMatch(/^ADJ\//);
    expect(await stockAt(p.id, shelfB)).toBe(3);
    expect(await applyCount(db, ORG_A, USER, { productId: p.id, locationId: shelfB, countedQuantity: 3, note: null })).toBeNull();
  });

  it("only changes stock when a draft operation is validated, and only once", async () => {
    const [p] = await listProducts(db, ORG_A, { q: "Rope" });
    const op = await createOperation(db, ORG_A, USER, {
      type: "receipt", sourceLocationId: null, destLocationId: shelfB, partner: "Supplier", note: null,
      lines: [{ productId: p.id, quantity: 10 }],
    });
    expect(await stockAt(p.id, shelfB)).toBe(3);
    await validateOperation(db, ORG_A, USER, op.id);
    expect(await stockAt(p.id, shelfB)).toBe(13);
    await expect(validateOperation(db, ORG_A, USER, op.id)).rejects.toThrow(AppError);
    await expect(cancelOperation(db, ORG_A, op.id)).rejects.toThrow(/Only draft/);
    expect(await stockAt(p.id, shelfB)).toBe(13);
  });

  it("flags products below their reordering rule", async () => {
    const [p] = await listProducts(db, ORG_A, { q: "HAM-1" });
    await upsertReorderRule(db, ORG_A, { productId: p.id, locationId: shelfA, minQuantity: 5, maxQuantity: 20 });
    const report = await replenishmentReport(db, ORG_A);
    expect(report.find((r) => r.productId === p.id)?.toOrder).toBe(20);
    expect((await dashboardStats(db, ORG_A)).lowStockCount).toBeGreaterThanOrEqual(1);
  });

  it("archived products cannot be moved", async () => {
    const [p] = await listProducts(db, ORG_A, { q: "Rope" });
    await setProductActive(db, ORG_A, p.id, false);
    await expect(
      adjustStock(db, ORG_A, USER, {
        direction: "add", productId: p.id, locationId: shelfA, amount: 1, reason: "restock", partner: null, note: null,
      }),
    ).rejects.toThrow(/archived/);
    await setProductActive(db, ORG_A, p.id, true);
  });
});

describe("tenant isolation", () => {
  it("workspace B cannot see or move workspace A's stock", async () => {
    const [p] = await listProducts(db, ORG_A, { q: "Rope" });
    expect(await listProducts(db, ORG_B)).toHaveLength(0);
    await expect(
      adjustStock(db, ORG_B, USER, {
        direction: "add", productId: p.id, locationId: otherOrgLoc, amount: 1, reason: "restock", partner: null, note: null,
      }),
    ).rejects.toThrow(/not found/i);
    await expect(
      adjustStock(db, ORG_A, USER, {
        direction: "add", productId: p.id, locationId: otherOrgLoc, amount: 1, reason: "restock", partner: null, note: null,
      }),
    ).rejects.toThrow(AppError);
  });
});
