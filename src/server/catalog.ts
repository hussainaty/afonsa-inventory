import { aliasedTable, and, asc, eq, ilike, or, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { category, location, product, stockMove, stockQuant } from "@/db/schema";
import type { CategoryInput, NewProductInput, ProductInput } from "@/lib/validation";
import { AppError, escapeLike, isUniqueViolation, newId } from "./common";
import { adjustStockTx } from "./stock";

// ---------- Categories (hierarchical, like Odoo product categories) ----------

export async function listCategories(db: DB, orgId: string) {
  const rows = await db
    .select({
      id: category.id,
      name: category.name,
      parentId: category.parentId,
      color: category.color,
      description: category.description,
      productCount: sql<number>`cast(count(${product.id}) as int)`,
    })
    .from(category)
    .leftJoin(product, and(eq(product.categoryId, category.id), eq(product.active, true)))
    .where(eq(category.organizationId, orgId))
    .groupBy(category.id);
  return withCategoryPaths(rows);
}

/** Adds "Parent / Child" display paths and sorts categories as a tree. */
export function withCategoryPaths<T extends { id: string; name: string; parentId: string | null }>(rows: T[]) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const pathOf = (r: T): string => {
    const parts: string[] = [];
    const seen = new Set<string>();
    for (let c: T | undefined = r; c && !seen.has(c.id); c = c.parentId ? byId.get(c.parentId) : undefined) {
      seen.add(c.id);
      parts.unshift(c.name);
    }
    return parts.join(" / ");
  };
  return rows
    .map((r) => ({ ...r, path: pathOf(r), depth: pathOf(r).split(" / ").length - 1 }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

async function assertCategoryParent(db: DB, orgId: string, id: string | null, parentId: string | null) {
  if (!parentId) return;
  const all = await db
    .select({ id: category.id, parentId: category.parentId })
    .from(category)
    .where(eq(category.organizationId, orgId));
  const byId = new Map(all.map((c) => [c.id, c.parentId]));
  if (!byId.has(parentId)) throw new AppError("Parent category not found");
  for (let cur: string | null | undefined = parentId; cur; cur = byId.get(cur)) {
    if (cur === id) throw new AppError("A category cannot be inside itself");
  }
}

export async function createCategory(db: DB, orgId: string, input: CategoryInput) {
  await assertCategoryParent(db, orgId, null, input.parentId);
  try {
    const [row] = await db.insert(category).values({ id: newId(), organizationId: orgId, ...input }).returning();
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("A category with that name already exists here");
    throw err;
  }
}

export async function updateCategory(db: DB, orgId: string, id: string, input: CategoryInput) {
  await assertCategoryParent(db, orgId, id, input.parentId);
  try {
    const [row] = await db
      .update(category)
      .set(input)
      .where(and(eq(category.id, id), eq(category.organizationId, orgId)))
      .returning();
    if (!row) throw new AppError("Category not found");
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("A category with that name already exists here");
    throw err;
  }
}

/** Products become uncategorized and child categories move up to the deleted category's parent. */
export async function deleteCategory(db: DB, orgId: string, id: string) {
  await db.transaction(async (tx) => {
    const cat = await tx.query.category.findFirst({
      where: and(eq(category.id, id), eq(category.organizationId, orgId)),
    });
    if (!cat) throw new AppError("Category not found");
    await tx
      .update(category)
      .set({ parentId: cat.parentId })
      .where(and(eq(category.organizationId, orgId), eq(category.parentId, id)));
    await tx.delete(category).where(eq(category.id, id));
  });
}

// ---------- Products ----------

async function assertCategory(db: DB, orgId: string, categoryId: string | null) {
  if (!categoryId) return;
  const found = await db.query.category.findFirst({
    where: and(eq(category.id, categoryId), eq(category.organizationId, orgId)),
    columns: { id: true },
  });
  if (!found) throw new AppError("Category not found");
}

function productConflict(err: unknown): never {
  if (isUniqueViolation(err))
    throw new AppError("A product with the same name and size, SKU or barcode already exists");
  throw err;
}

export async function createProduct(db: DB, orgId: string, userId: string, input: NewProductInput) {
  await assertCategory(db, orgId, input.categoryId);
  const { initialQuantity, initialLocationId, cost, salePrice, ...rest } = input;
  if (initialQuantity > 0 && !initialLocationId) throw new AppError("Choose where the opening stock is stored");

  try {
    // Product and opening stock are created atomically.
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(product)
        .values({
          id: newId(),
          organizationId: orgId,
          createdById: userId,
          costCents: cost,
          salePriceCents: salePrice,
          ...rest,
        })
        .returning();
      if (initialQuantity > 0 && initialLocationId) {
        await adjustStockTx(tx, orgId, userId, {
          direction: "add",
          productId: created.id,
          locationId: initialLocationId,
          amount: initialQuantity,
          reason: "found",
          partner: null,
          note: "Opening stock",
        });
      }
      return created;
    });
  } catch (err) {
    productConflict(err);
  }
}

export async function updateProduct(db: DB, orgId: string, id: string, input: ProductInput) {
  await assertCategory(db, orgId, input.categoryId);
  const { cost, salePrice, ...rest } = input;
  try {
    const [row] = await db
      .update(product)
      .set({ ...rest, costCents: cost, salePriceCents: salePrice })
      .where(and(eq(product.id, id), eq(product.organizationId, orgId)))
      .returning();
    if (!row) throw new AppError("Product not found");
    return row;
  } catch (err) {
    productConflict(err);
  }
}

/** Products with stock history are archived, never hard-deleted, so the audit trail survives. */
export async function setProductActive(db: DB, orgId: string, id: string, active: boolean) {
  const [row] = await db
    .update(product)
    .set({ active })
    .where(and(eq(product.id, id), eq(product.organizationId, orgId)))
    .returning({ id: product.id });
  if (!row) throw new AppError("Product not found");
}

export async function deleteProduct(db: DB, orgId: string, id: string) {
  const [moves] = await db
    .select({ n: sql<number>`cast(count(*) as int)` })
    .from(stockMove)
    .where(and(eq(stockMove.productId, id), eq(stockMove.organizationId, orgId)));
  if (moves.n > 0) throw new AppError("This product has stock history. Archive it instead.");
  const rows = await db
    .delete(product)
    .where(and(eq(product.id, id), eq(product.organizationId, orgId)))
    .returning({ id: product.id });
  if (rows.length === 0) throw new AppError("Product not found");
}

export type ProductFilters = {
  q?: string;
  categoryId?: string; // "none" = uncategorized; includes sub-categories
  locationId?: string; // only products stored in this location (or its sub-locations)
  stock?: "low" | "out" | "in";
  archived?: boolean;
};

/** Product list with on-hand totals (optionally scoped to a location subtree). */
export async function listProducts(db: DB, orgId: string, f: ProductFilters = {}) {
  let locPrefix: string | null = null;
  if (f.locationId) {
    const loc = await db.query.location.findFirst({
      where: and(eq(location.id, f.locationId), eq(location.organizationId, orgId)),
      columns: { fullName: true },
    });
    locPrefix = loc?.fullName ?? "\u0000";
  }

  const quantInScope = locPrefix
    ? sql`and ${stockQuant.locationId} in (select l.id from inventory.location l where l.organization_id = ${orgId} and (l.full_name = ${locPrefix} or l.full_name like ${`${escapeLike(locPrefix)}/%`}))`
    : sql``;

  const onHand = sql<number>`cast(coalesce((select sum(${stockQuant.quantity}) from ${stockQuant} where ${stockQuant.productId} = ${product.id} ${quantInScope}), 0) as float8)`;
  const minQty = sql<number>`cast(coalesce((select sum(r.min_quantity) from inventory.reorder_rule r where r.product_id = ${product.id}), 0) as float8)`;

  const conds = [eq(product.organizationId, orgId), eq(product.active, !f.archived)];
  const q = f.q?.trim();
  if (q) {
    const pat = `%${escapeLike(q)}%`;
    conds.push(
      or(ilike(product.name, pat), ilike(product.variant, pat), ilike(product.sku, pat), ilike(product.barcode, pat))!,
    );
  }
  if (f.categoryId === "none") conds.push(sql`${product.categoryId} is null`);
  else if (f.categoryId) {
    conds.push(sql`${product.categoryId} in (
      with recursive tree as (
        select id from inventory.category where id = ${f.categoryId} and organization_id = ${orgId}
        union all
        select c.id from inventory.category c join tree t on c.parent_id = t.id
      ) select id from tree)`);
  }
  if (locPrefix) conds.push(sql`${onHand} <> 0`);
  if (f.stock === "out") conds.push(sql`${onHand} <= 0`);
  if (f.stock === "in") conds.push(sql`${onHand} > 0`);
  if (f.stock === "low") conds.push(sql`${minQty} > 0 and ${onHand} <= ${minQty}`);

  return db
    .select({
      id: product.id,
      name: product.name,
      variant: product.variant,
      sku: product.sku,
      barcode: product.barcode,
      uom: product.uom,
      salePriceCents: product.salePriceCents,
      costCents: product.costCents,
      categoryId: product.categoryId,
      categoryName: category.name,
      categoryColor: category.color,
      onHand,
      minQty,
      updatedAt: product.updatedAt,
    })
    .from(product)
    .leftJoin(category, eq(category.id, product.categoryId))
    .where(and(...conds))
    .orderBy(asc(product.name), asc(product.variant))
    .limit(1000);
}

export async function getProduct(db: DB, orgId: string, id: string) {
  const [row] = await db
    .select({ product, categoryName: category.name, categoryColor: category.color })
    .from(product)
    .leftJoin(category, eq(category.id, product.categoryId))
    .where(and(eq(product.id, id), eq(product.organizationId, orgId)));
  return row ?? null;
}

export async function findProductByCode(db: DB, orgId: string, code: string) {
  const c = code.trim();
  if (!c) return null;
  return db.query.product.findFirst({
    where: and(
      eq(product.organizationId, orgId),
      or(eq(product.barcode, c), sql`lower(${product.sku}) = lower(${c})`),
    ),
    columns: { id: true },
  });
}

/** Other sizes/variants of the same part: products sharing the name. */
export async function listSizes(db: DB, orgId: string, name: string) {
  // Aliased on purpose: without a join Drizzle leaves columns unqualified, and the
  // stock subquery's "id" would then bind to stock_quant instead of product.
  const p = aliasedTable(product, "p");
  return db
    .select({
      id: p.id,
      variant: p.variant,
      uom: p.uom,
      active: p.active,
      onHand: sql<number>`cast(coalesce((select sum(q.quantity) from inventory.stock_quant q where q.product_id = "p"."id"), 0) as float8)`,
    })
    .from(p)
    .where(and(eq(p.organizationId, orgId), sql`lower(${p.name}) = lower(${name})`))
    .orderBy(asc(p.variant));
}
