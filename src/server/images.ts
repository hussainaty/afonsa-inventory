import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { product, productImage } from "@/db/schema";
import { AppError, newId } from "./common";
import type { Storage } from "./storage";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_PRODUCT = 12;

const TYPES = [
  { type: "image/jpeg", ext: "jpg", test: (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: "image/png",
    ext: "png",
    test: (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    type: "image/webp",
    ext: "webp",
    test: (b: Uint8Array) =>
      String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP",
  },
] as const;

/** Detects the real image type from its bytes; the browser-declared type is not trusted. */
export function sniffImageType(bytes: Uint8Array) {
  return TYPES.find((t) => bytes.length >= 12 && t.test(bytes)) ?? null;
}

async function assertProduct(db: DB, orgId: string, productId: string) {
  const found = await db.query.product.findFirst({
    where: and(eq(product.id, productId), eq(product.organizationId, orgId)),
    columns: { id: true },
  });
  if (!found) throw new AppError("Product not found");
}

export async function listProductImages(db: DB, orgId: string, productId: string) {
  return db
    .select({ id: productImage.id, position: productImage.position, width: productImage.width, height: productImage.height })
    .from(productImage)
    .where(and(eq(productImage.organizationId, orgId), eq(productImage.productId, productId)))
    .orderBy(asc(productImage.position), asc(productImage.createdAt));
}

/** Main photo id per product, for list thumbnails. */
export async function mainImageIds(db: DB, orgId: string, productIds: string[]) {
  if (productIds.length === 0) return new Map<string, string>();
  const rows = await db
    .selectDistinctOn([productImage.productId], { productId: productImage.productId, id: productImage.id })
    .from(productImage)
    .where(and(eq(productImage.organizationId, orgId), inArray(productImage.productId, productIds)))
    .orderBy(productImage.productId, asc(productImage.position), asc(productImage.createdAt));
  return new Map(rows.map((r) => [r.productId, r.id]));
}

export async function addProductImage(
  db: DB,
  storage: Storage,
  orgId: string,
  userId: string,
  productId: string,
  file: { bytes: Uint8Array; width?: number | null; height?: number | null },
) {
  await assertProduct(db, orgId, productId);
  if (file.bytes.byteLength === 0) throw new AppError("The file is empty");
  if (file.bytes.byteLength > MAX_IMAGE_BYTES) throw new AppError("Photos must be smaller than 5 MB");
  const kind = sniffImageType(file.bytes);
  if (!kind) throw new AppError("Only JPEG, PNG or WebP photos are supported");

  const [{ n }] = await db
    .select({ n: sql<number>`cast(count(*) as int)` })
    .from(productImage)
    .where(and(eq(productImage.organizationId, orgId), eq(productImage.productId, productId)));
  if (n >= MAX_IMAGES_PER_PRODUCT) throw new AppError(`A product can have at most ${MAX_IMAGES_PER_PRODUCT} photos`);

  const id = newId();
  const storageKey = `${orgId}/products/${productId}/${id}.${kind.ext}`;
  await storage.put(storageKey, file.bytes, kind.type);
  try {
    const [row] = await db
      .insert(productImage)
      .values({
        id,
        organizationId: orgId,
        productId,
        storageKey,
        contentType: kind.type,
        sizeBytes: file.bytes.byteLength,
        width: file.width ?? null,
        height: file.height ?? null,
        position: n,
        createdById: userId,
      })
      .returning({ id: productImage.id });
    return row;
  } catch (err) {
    await storage.delete(storageKey).catch(() => {});
    throw err;
  }
}

export async function getImageForMember(db: DB, orgId: string, imageId: string) {
  const row = await db.query.productImage.findFirst({
    where: and(eq(productImage.id, imageId), eq(productImage.organizationId, orgId)),
    columns: { storageKey: true, contentType: true },
  });
  return row ?? null;
}

export async function deleteProductImage(db: DB, storage: Storage, orgId: string, imageId: string) {
  const [row] = await db
    .delete(productImage)
    .where(and(eq(productImage.id, imageId), eq(productImage.organizationId, orgId)))
    .returning({ storageKey: productImage.storageKey });
  if (!row) throw new AppError("Photo not found");
  await storage.delete(row.storageKey).catch((err) => console.error("[storage] delete failed", err));
}

/** Makes a photo the main one (position 0) and keeps the others in order. */
export async function makeMainImage(db: DB, orgId: string, imageId: string) {
  await db.transaction(async (tx) => {
    const img = await tx.query.productImage.findFirst({
      where: and(eq(productImage.id, imageId), eq(productImage.organizationId, orgId)),
      columns: { productId: true },
    });
    if (!img) throw new AppError("Photo not found");
    const all = await tx
      .select({ id: productImage.id })
      .from(productImage)
      .where(eq(productImage.productId, img.productId))
      .orderBy(asc(productImage.position), asc(productImage.createdAt));
    const order = [imageId, ...all.map((a) => a.id).filter((id) => id !== imageId)];
    for (const [position, id] of order.entries()) {
      await tx.update(productImage).set({ position }).where(eq(productImage.id, id));
    }
  });
}


export async function productImageKeys(db: DB, orgId: string, productId: string) {
  const rows = await db
    .select({ storageKey: productImage.storageKey })
    .from(productImage)
    .where(and(eq(productImage.organizationId, orgId), eq(productImage.productId, productId)));
  return rows.map((r) => r.storageKey);
}
