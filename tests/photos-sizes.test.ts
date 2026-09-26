import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type DB } from "@/db";
import { organization, user } from "@/db/schema";
import { addStockToNewSize, createProduct, listProducts, listSizes, updateProduct } from "@/server/catalog";
import {
  addProductImage,
  deleteProductImage,
  listProductImages,
  mainImageIds,
  makeMainImage,
  sniffImageType,
} from "@/server/images";
import { ensureWorkspaceSetup, listInternalLocations } from "@/server/locations";
import type { Storage } from "@/server/storage";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const WEBP = new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ");
const HTML = new TextEncoder().encode("<html><script>alert(1)</script>");

function memoryStorage() {
  const files = new Map<string, Uint8Array>();
  const storage: Storage = {
    kind: "local",
    async put(key, body) {
      files.set(key, body);
    },
    async delete(key) {
      files.delete(key);
    },
    async signedUrl() {
      return null;
    },
    async read(key) {
      return files.get(key)!;
    },
  };
  return { storage, files };
}

let db: DB;
const base = { variant: null, familyId: null, categoryId: null, sku: null, barcode: null, uom: "pcs", cost: null, salePrice: null, description: null, initialQuantity: 0, initialLocationId: null };

beforeAll(async () => {
  db = createDb("");
  await migrate(db as never, { migrationsFolder: "drizzle", migrationsSchema: "inventory" });
  await db.insert(user).values({ id: "u1", name: "U", email: "u@example.com" });
  await db.insert(organization).values([
    { id: "o1", name: "O1", slug: "o1" },
    { id: "o2", name: "O2", slug: "o2" },
  ]);
  await ensureWorkspaceSetup(db, "o1");
  await ensureWorkspaceSetup(db, "o2");
});

describe("items with sizes", () => {
  let familyId: string;

  it("adds stock of a brand-new size to the same item", async () => {
    const rim15 = await createProduct(db, "o1", "u1", { ...base, name: "Wheel rim", variant: "15 inch" });
    familyId = rim15.familyId;
    expect(familyId).toBe(rim15.id);
    const stock = (await listInternalLocations(db, "o1"))[0];
    const res = await addStockToNewSize(db, "o1", "u1", {
      familyId, variant: "18 inch", locationId: stock.id, amount: 7, reason: "restock", partner: null, note: null,
    });
    expect(res.reference).toMatch(/^IN\//);
    const sizes = await listSizes(db, "o1", familyId);
    expect(sizes.map((s) => [s.variant, s.onHand])).toEqual([["15 inch", 0], ["18 inch", 7]]);
    expect((await listProducts(db, "o1", { q: "18 inch" })).map((p) => p.familyId)).toEqual([familyId]);
  });

  it("rejects a size the item already has", async () => {
    const stock = (await listInternalLocations(db, "o1"))[0];
    await expect(
      addStockToNewSize(db, "o1", "u1", {
        familyId, variant: "18 INCH", locationId: stock.id, amount: 1, reason: "restock", partner: null, note: null,
      }),
    ).rejects.toThrow(/already exists/);
    expect((await listSizes(db, "o1", familyId)).find((s) => s.variant === "18 inch")?.onHand).toBe(7);
  });

  it("keeps item-level fields shared when one size is edited", async () => {
    const [rim15] = await listProducts(db, "o1", { q: "15 inch" });
    await updateProduct(db, "o1", rim15.id, {
      name: "Alloy wheel rim", variant: "15 inch", categoryId: null, sku: "RIM-15", barcode: null,
      uom: "pcs", cost: null, salePrice: 5000, description: null,
    });
    const all = await listProducts(db, "o1", { q: "Alloy wheel rim" });
    expect(all.map((p) => [p.variant, p.sku, p.salePriceCents])).toEqual([
      ["15 inch", "RIM-15", 5000],
      ["18 inch", null, null],
    ]);
  });

  it("does not let another workspace add sizes to the item", async () => {
    const other = (await listInternalLocations(db, "o2"))[0];
    await expect(
      addStockToNewSize(db, "o2", "u1", {
        familyId, variant: "20 inch", locationId: other.id, amount: 1, reason: "restock", partner: null, note: null,
      }),
    ).rejects.toThrow(/Item not found/);
  });
});

describe("product photos", () => {
  it("detects real image types and rejects disguised files", () => {
    expect(sniffImageType(JPEG)?.type).toBe("image/jpeg");
    expect(sniffImageType(PNG)?.type).toBe("image/png");
    expect(sniffImageType(WEBP)?.type).toBe("image/webp");
    expect(sniffImageType(HTML)).toBeNull();
  });

  it("stores photos under the workspace, orders them and cleans up files", async () => {
    const { storage, files } = memoryStorage();
    const [rim] = await listProducts(db, "o1", { q: "15 inch" });
    const a = await addProductImage(db, storage, "o1", "u1", rim.id, { bytes: JPEG });
    const b = await addProductImage(db, storage, "o1", "u1", rim.id, { bytes: WEBP });
    expect([...files.keys()].every((k) => k.startsWith(`o1/products/${rim.id}/`))).toBe(true);

    expect((await mainImageIds(db, "o1", [rim.id])).get(rim.id)).toBe(a.id);
    await makeMainImage(db, "o1", b.id);
    expect((await listProductImages(db, "o1", rim.id)).map((i) => i.id)).toEqual([b.id, a.id]);

    await deleteProductImage(db, storage, "o1", a.id);
    expect(files.size).toBe(1);
  });

  it("refuses non-images and other workspaces' products", async () => {
    const { storage, files } = memoryStorage();
    const [rim] = await listProducts(db, "o1", { q: "18 inch" });
    await expect(addProductImage(db, storage, "o1", "u1", rim.id, { bytes: HTML })).rejects.toThrow(/JPEG, PNG or WebP/);
    await expect(addProductImage(db, storage, "o2", "u1", rim.id, { bytes: JPEG })).rejects.toThrow(/not found/);
    const [img] = await listProductImages(db, "o1", (await listProducts(db, "o1", { q: "15 inch" }))[0].id);
    await expect(deleteProductImage(db, storage, "o2", img.id)).rejects.toThrow(/not found/);
    expect(files.size).toBe(0);
  });
});
