import { and, asc, eq, inArray, like, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { location, stockQuant, warehouse, type LocationType } from "@/db/schema";
import { AppError, escapeLike, type Executor, isUniqueViolation, newId } from "./common";

export const SYSTEM_LOCATIONS = {
  vendor: { name: "Vendors", fullName: "Partners/Vendors", type: "vendor" },
  customer: { name: "Customers", fullName: "Partners/Customers", type: "customer" },
  inventory: { name: "Inventory adjustment", fullName: "Virtual/Inventory adjustment", type: "inventory" },
  scrap: { name: "Scrap", fullName: "Virtual/Scrap", type: "scrap" },
} as const satisfies Record<string, { name: string; fullName: string; type: LocationType }>;
export type SystemLocationKey = keyof typeof SYSTEM_LOCATIONS;

/**
 * Creates the virtual partner/adjustment locations and, for a new workspace,
 * a default "Main Warehouse" with a "Stock" location. Safe to call repeatedly.
 */
export async function ensureWorkspaceSetup(db: DB, orgId: string) {
  await db.transaction(async (tx) => {
    for (const [key, def] of Object.entries(SYSTEM_LOCATIONS)) {
      await tx
        .insert(location)
        .values({ id: newId(), organizationId: orgId, systemKey: key, ...def })
        .onConflictDoNothing();
    }
    const existing = await tx.query.warehouse.findFirst({
      where: eq(warehouse.organizationId, orgId),
      columns: { id: true },
    });
    if (!existing) await createWarehouseTx(tx, orgId, { name: "Main Warehouse", code: "WH", address: null });
  });
}

export async function getSystemLocationId(db: Executor, orgId: string, key: SystemLocationKey) {
  const row = await db.query.location.findFirst({
    where: and(eq(location.organizationId, orgId), eq(location.systemKey, key)),
    columns: { id: true },
  });
  if (!row) throw new AppError("Workspace is not set up yet. Reload the page and try again.");
  return row.id;
}

async function createWarehouseTx(
  tx: Executor,
  orgId: string,
  input: { name: string; code: string; address: string | null },
) {
  const whId = newId();
  const viewId = newId();
  await tx.insert(warehouse).values({ id: whId, organizationId: orgId, ...input });
  await tx.insert(location).values([
    { id: viewId, organizationId: orgId, warehouseId: whId, name: input.code, fullName: input.code, type: "view" },
    {
      id: newId(),
      organizationId: orgId,
      warehouseId: whId,
      parentId: viewId,
      name: "Stock",
      fullName: `${input.code}/Stock`,
      type: "internal",
    },
  ]);
  return whId;
}

export async function createWarehouse(
  db: DB,
  orgId: string,
  input: { name: string; code: string; address: string | null },
) {
  try {
    return await db.transaction((tx) => createWarehouseTx(tx, orgId, input));
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("A warehouse with that code already exists");
    throw err;
  }
}

export async function listWarehouses(db: DB, orgId: string) {
  return db.query.warehouse.findMany({
    where: and(eq(warehouse.organizationId, orgId), eq(warehouse.active, true)),
    orderBy: asc(warehouse.name),
  });
}

/** Internal (stock-holding) locations with their on-hand totals, sorted as a tree by path. */
export async function listInternalLocations(db: DB, orgId: string) {
  return db
    .select({
      id: location.id,
      name: location.name,
      fullName: location.fullName,
      parentId: location.parentId,
      warehouseId: location.warehouseId,
      barcode: location.barcode,
      productCount: sql<number>`cast(count(${stockQuant.id}) filter (where ${stockQuant.quantity} <> 0) as int)`,
      totalQuantity: sql<number>`cast(coalesce(sum(${stockQuant.quantity}), 0) as float8)`,
    })
    .from(location)
    .leftJoin(stockQuant, eq(stockQuant.locationId, location.id))
    .where(
      and(eq(location.organizationId, orgId), eq(location.type, "internal"), eq(location.active, true)),
    )
    .groupBy(location.id)
    .orderBy(asc(location.fullName));
}

/** Adds a sub-location (section, shelf, bin...) under an internal location or warehouse view. */
export async function createLocation(
  db: DB,
  orgId: string,
  input: { parentId: string; name: string; barcode: string | null },
) {
  const parent = await db.query.location.findFirst({
    where: and(eq(location.id, input.parentId), eq(location.organizationId, orgId)),
  });
  if (!parent || !parent.warehouseId || (parent.type !== "internal" && parent.type !== "view")) {
    throw new AppError("Choose a warehouse location as the parent");
  }
  if (input.name.includes("/")) throw new AppError("Location names cannot contain “/”");
  try {
    const [row] = await db
      .insert(location)
      .values({
        id: newId(),
        organizationId: orgId,
        warehouseId: parent.warehouseId,
        parentId: parent.id,
        name: input.name,
        fullName: `${parent.fullName}/${input.name}`,
        type: "internal",
        barcode: input.barcode,
      })
      .returning();
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("That location already exists");
    throw err;
  }
}

/** Renames a location and rewrites the stored paths of all of its descendants. */
export async function renameLocation(db: DB, orgId: string, id: string, name: string) {
  if (name.includes("/")) throw new AppError("Location names cannot contain “/”");
  await db.transaction(async (tx) => {
    const loc = await tx.query.location.findFirst({
      where: and(eq(location.id, id), eq(location.organizationId, orgId), eq(location.type, "internal")),
    });
    if (!loc) throw new AppError("Location not found");
    const oldPath = loc.fullName;
    const newPath = oldPath.slice(0, oldPath.length - loc.name.length) + name;
    try {
      await tx.update(location).set({ name, fullName: newPath }).where(eq(location.id, id));
      await tx
        .update(location)
        .set({ fullName: sql`${newPath} || substr(${location.fullName}, ${oldPath.length + 1})` })
        .where(and(eq(location.organizationId, orgId), like(location.fullName, `${escapeLike(oldPath)}/%`)));
    } catch (err) {
      if (isUniqueViolation(err)) throw new AppError("That location already exists");
      throw err;
    }
  });
}

/** Archives a location (and its children) once it holds no stock. */
export async function archiveLocation(db: DB, orgId: string, id: string) {
  await db.transaction(async (tx) => {
    const loc = await tx.query.location.findFirst({
      where: and(eq(location.id, id), eq(location.organizationId, orgId), eq(location.type, "internal")),
    });
    if (!loc) throw new AppError("Location not found");
    const subtree = await tx
      .select({ id: location.id })
      .from(location)
      .where(
        and(
          eq(location.organizationId, orgId),
          sql`(${location.id} = ${id} or ${location.fullName} like ${`${escapeLike(loc.fullName)}/%`})`,
        ),
      );
    const ids = subtree.map((r) => r.id);
    const [stock] = await tx
      .select({ n: sql<number>`cast(count(*) as int)` })
      .from(stockQuant)
      .where(and(inArray(stockQuant.locationId, ids), sql`${stockQuant.quantity} <> 0`));
    if (stock.n > 0) throw new AppError("Move or remove the stock in this location before archiving it");
    await tx.update(location).set({ active: false }).where(inArray(location.id, ids));
  });
}
