import { aliasedTable, and, desc, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "@/db";
import {
  category,
  location,
  operation,
  product,
  reorderRule,
  stockMove,
  stockQuant,
  user,
  type OperationState,
  type OperationType,
} from "@/db/schema";
import type { ReorderRuleInput } from "@/lib/validation";
import { AppError, newId } from "./common";

const srcLoc = aliasedTable(location, "src_loc");
const dstLoc = aliasedTable(location, "dst_loc");

export async function dashboardStats(db: DB, orgId: string) {
  const [p] = await db
    .select({
      productCount: sql<number>`cast(count(*) as int)`,
      categoryCount: sql<number>`cast((select count(*) from ${category} where ${category.organizationId} = ${orgId}) as int)`,
    })
    .from(product)
    .where(and(eq(product.organizationId, orgId), eq(product.active, true)));

  const [s] = await db
    .select({
      totalUnits: sql<number>`cast(coalesce(sum(${stockQuant.quantity}), 0) as float8)`,
      stockValueCents: sql<number>`cast(coalesce(sum(${stockQuant.quantity} * coalesce(${product.costCents}, 0)), 0) as float8)`,
      locationCount: sql<number>`cast(count(distinct ${stockQuant.locationId}) filter (where ${stockQuant.quantity} > 0) as int)`,
    })
    .from(stockQuant)
    .innerJoin(product, eq(product.id, stockQuant.productId))
    .where(and(eq(stockQuant.organizationId, orgId), eq(product.active, true)));

  const [pending] = await db
    .select({ n: sql<number>`cast(count(*) as int)` })
    .from(operation)
    .where(and(eq(operation.organizationId, orgId), eq(operation.state, "draft")));

  const replenish = await replenishmentReport(db, orgId);
  return { ...p, ...s, draftOperations: pending.n, lowStockCount: replenish.length };
}

/** On-hand quantity of one product per storage location. */
export async function productStockByLocation(db: DB, orgId: string, productId: string) {
  return db
    .select({
      locationId: location.id,
      fullName: location.fullName,
      name: location.name,
      quantity: stockQuant.quantity,
    })
    .from(stockQuant)
    .innerJoin(location, eq(location.id, stockQuant.locationId))
    .where(
      and(
        eq(stockQuant.organizationId, orgId),
        eq(stockQuant.productId, productId),
        sql`${stockQuant.quantity} <> 0`,
      ),
    )
    .orderBy(location.fullName);
}

/** All products stored in a location subtree, with quantities per exact location. */
export async function locationContents(db: DB, orgId: string, locationId: string) {
  const loc = await db.query.location.findFirst({
    where: and(eq(location.id, locationId), eq(location.organizationId, orgId)),
  });
  if (!loc) return null;
  const rows = await db
    .select({
      productId: product.id,
      productName: product.name,
      productVariant: product.variant,
      sku: product.sku,
      uom: product.uom,
      locationId: location.id,
      locationName: location.fullName,
      quantity: stockQuant.quantity,
    })
    .from(stockQuant)
    .innerJoin(location, eq(location.id, stockQuant.locationId))
    .innerJoin(product, eq(product.id, stockQuant.productId))
    .where(
      and(
        eq(stockQuant.organizationId, orgId),
        sql`${stockQuant.quantity} <> 0`,
        sql`(${location.id} = ${loc.id} or ${location.fullName} like ${`${loc.fullName.replace(/[\\%_]/g, (c) => `\\${c}`)}/%`})`,
      ),
    )
    .orderBy(product.name, location.fullName);
  return { location: loc, rows };
}

export type MoveFilters = { productId?: string; locationId?: string; limit?: number };

/** Stock move history (the audit trail), newest first. */
export async function listMoves(db: DB, orgId: string, f: MoveFilters = {}) {
  const conds = [eq(stockMove.organizationId, orgId), eq(stockMove.state, "done")];
  if (f.productId) conds.push(eq(stockMove.productId, f.productId));
  if (f.locationId)
    conds.push(sql`(${stockMove.sourceLocationId} = ${f.locationId} or ${stockMove.destLocationId} = ${f.locationId})`);
  return db
    .select({
      id: stockMove.id,
      quantity: stockMove.quantity,
      doneAt: stockMove.doneAt,
      productId: product.id,
      productName: product.name,
      productVariant: product.variant,
      uom: product.uom,
      sourceName: srcLoc.fullName,
      sourceType: srcLoc.type,
      destName: dstLoc.fullName,
      destType: dstLoc.type,
      operationId: operation.id,
      reference: operation.reference,
      operationType: operation.type,
      note: operation.note,
      userName: user.name,
    })
    .from(stockMove)
    .innerJoin(product, eq(product.id, stockMove.productId))
    .innerJoin(srcLoc, eq(srcLoc.id, stockMove.sourceLocationId))
    .innerJoin(dstLoc, eq(dstLoc.id, stockMove.destLocationId))
    .innerJoin(operation, eq(operation.id, stockMove.operationId))
    .leftJoin(user, eq(user.id, operation.validatedById))
    .where(and(...conds))
    .orderBy(desc(stockMove.doneAt))
    .limit(Math.min(f.limit ?? 100, 500));
}

export async function listOperations(
  db: DB,
  orgId: string,
  f: { state?: OperationState; type?: OperationType } = {},
) {
  const conds = [eq(operation.organizationId, orgId)];
  if (f.state) conds.push(eq(operation.state, f.state));
  if (f.type) conds.push(eq(operation.type, f.type));
  return db
    .select({
      id: operation.id,
      reference: operation.reference,
      type: operation.type,
      state: operation.state,
      partner: operation.partner,
      createdAt: operation.createdAt,
      validatedAt: operation.validatedAt,
      sourceName: srcLoc.fullName,
      destName: dstLoc.fullName,
      lineCount: sql<number>`cast((select count(*) from ${stockMove} where ${stockMove.operationId} = ${operation.id}) as int)`,
    })
    .from(operation)
    .innerJoin(srcLoc, eq(srcLoc.id, operation.sourceLocationId))
    .innerJoin(dstLoc, eq(dstLoc.id, operation.destLocationId))
    .where(and(...conds))
    .orderBy(desc(operation.createdAt))
    .limit(200);
}

export async function getOperation(db: DB, orgId: string, id: string) {
  const [op] = await db
    .select({
      operation,
      sourceName: srcLoc.fullName,
      destName: dstLoc.fullName,
    })
    .from(operation)
    .innerJoin(srcLoc, eq(srcLoc.id, operation.sourceLocationId))
    .innerJoin(dstLoc, eq(dstLoc.id, operation.destLocationId))
    .where(and(eq(operation.id, id), eq(operation.organizationId, orgId)));
  if (!op) return null;
  const lines = await db
    .select({
      id: stockMove.id,
      quantity: stockMove.quantity,
      productId: product.id,
      productName: product.name,
      productVariant: product.variant,
      sku: product.sku,
      uom: product.uom,
    })
    .from(stockMove)
    .innerJoin(product, eq(product.id, stockMove.productId))
    .where(eq(stockMove.operationId, id))
    .orderBy(product.name);
  const people = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(
      inArray(
        user.id,
        [op.operation.createdById, op.operation.validatedById].filter((v): v is string => Boolean(v)).concat(["-"]),
      ),
    );
  const nameOf = (uid: string | null) => people.find((p) => p.id === uid)?.name ?? null;
  return {
    ...op,
    lines,
    createdByName: nameOf(op.operation.createdById),
    validatedByName: nameOf(op.operation.validatedById),
  };
}

// ---------- Reordering rules & replenishment ----------

export async function listReorderRules(db: DB, orgId: string, productId?: string) {
  const conds = [eq(reorderRule.organizationId, orgId)];
  if (productId) conds.push(eq(reorderRule.productId, productId));
  return db
    .select({
      id: reorderRule.id,
      productId: reorderRule.productId,
      productName: product.name,
      productVariant: product.variant,
      locationId: reorderRule.locationId,
      locationName: location.fullName,
      minQuantity: reorderRule.minQuantity,
      maxQuantity: reorderRule.maxQuantity,
    })
    .from(reorderRule)
    .innerJoin(product, eq(product.id, reorderRule.productId))
    .innerJoin(location, eq(location.id, reorderRule.locationId))
    .where(and(...conds))
    .orderBy(product.name);
}

export async function upsertReorderRule(db: DB, orgId: string, input: ReorderRuleInput) {
  const prod = await db.query.product.findFirst({
    where: and(eq(product.id, input.productId), eq(product.organizationId, orgId)),
    columns: { id: true },
  });
  const loc = await db.query.location.findFirst({
    where: and(eq(location.id, input.locationId), eq(location.organizationId, orgId), eq(location.type, "internal")),
    columns: { id: true },
  });
  if (!prod || !loc) throw new AppError("Product or location not found");
  await db
    .insert(reorderRule)
    .values({ id: newId(), organizationId: orgId, ...input })
    .onConflictDoUpdate({
      target: [reorderRule.productId, reorderRule.locationId],
      set: { minQuantity: input.minQuantity, maxQuantity: input.maxQuantity, updatedAt: new Date() },
    });
}

export async function deleteReorderRule(db: DB, orgId: string, id: string) {
  await db.delete(reorderRule).where(and(eq(reorderRule.id, id), eq(reorderRule.organizationId, orgId)));
}

/**
 * Products at or below their minimum at a rule's location (including sub-locations),
 * with the quantity needed to get back to the maximum.
 */
export async function replenishmentReport(db: DB, orgId: string) {
  const rows = await db
    .select({
      ruleId: reorderRule.id,
      productId: product.id,
      productName: product.name,
      productVariant: product.variant,
      sku: product.sku,
      uom: product.uom,
      locationId: location.id,
      locationName: location.fullName,
      minQuantity: reorderRule.minQuantity,
      maxQuantity: reorderRule.maxQuantity,
      onHand: sql<number>`cast(coalesce((
        select sum(q.quantity) from inventory.stock_quant q
        join inventory.location l on l.id = q.location_id
        where q.product_id = ${product.id}
          and (l.id = ${location.id} or l.full_name like replace(replace(replace(${location.fullName}, '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '/%')
      ), 0) as float8)`,
    })
    .from(reorderRule)
    .innerJoin(product, eq(product.id, reorderRule.productId))
    .innerJoin(location, eq(location.id, reorderRule.locationId))
    .where(and(eq(reorderRule.organizationId, orgId), eq(product.active, true)));
  return rows
    .filter((r) => r.onHand <= r.minQuantity)
    .map((r) => ({ ...r, toOrder: Math.max(0, r.maxQuantity - r.onHand) }))
    .sort((a, b) => a.onHand - a.minQuantity - (b.onHand - b.minQuantity));
}

/** On-hand stock of every size of an item, per location. */
export async function familyStock(db: DB, orgId: string, familyId: string) {
  return db
    .select({
      productId: product.id,
      variant: product.variant,
      locationId: location.id,
      fullName: location.fullName,
      quantity: stockQuant.quantity,
    })
    .from(stockQuant)
    .innerJoin(product, eq(product.id, stockQuant.productId))
    .innerJoin(location, eq(location.id, stockQuant.locationId))
    .where(
      and(
        eq(stockQuant.organizationId, orgId),
        eq(product.familyId, familyId),
        sql`${stockQuant.quantity} <> 0`,
      ),
    )
    .orderBy(product.variant, location.fullName);
}
