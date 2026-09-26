import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "@/db";
import {
  location,
  operation,
  product,
  sequence,
  stockMove,
  stockQuant,
  type OperationType,
} from "@/db/schema";
import type { CountInput, OperationInput, StockAdjustInput, TransferInput } from "@/lib/validation";
import { AppError, newId, roundQty, type Tx } from "./common";
import { getSystemLocationId, type SystemLocationKey } from "./locations";

const PREFIX: Record<OperationType, string> = {
  receipt: "IN",
  delivery: "OUT",
  internal: "INT",
  adjustment: "ADJ",
  scrap: "SCRP",
};

/** Gap-free per-workspace counter, safe under concurrency (row lock via upsert). */
async function nextReference(tx: Tx, orgId: string, type: OperationType) {
  const code = PREFIX[type];
  const [row] = await tx
    .insert(sequence)
    .values({ organizationId: orgId, code, next: 2 })
    .onConflictDoUpdate({
      target: [sequence.organizationId, sequence.code],
      set: { next: sql`${sequence.next} + 1` },
    })
    .returning({ next: sequence.next });
  return `${code}/${String(row.next - 1).padStart(5, "0")}`;
}

type MoveSpec = { productId: string; sourceLocationId: string; destLocationId: string; quantity: number };

/**
 * The single place where on-hand stock changes. Validates every move against the
 * workspace, then applies it as a double entry: decrement the source quant (never
 * below zero) and increment the destination quant, for internal locations only.
 */
async function applyMoves(tx: Tx, orgId: string, moves: MoveSpec[]) {
  const locIds = [...new Set(moves.flatMap((m) => [m.sourceLocationId, m.destLocationId]))];
  const prodIds = [...new Set(moves.map((m) => m.productId))];

  const locs = await tx
    .select({ id: location.id, type: location.type, active: location.active, fullName: location.fullName })
    .from(location)
    .where(and(eq(location.organizationId, orgId), inArray(location.id, locIds)));
  const locById = new Map(locs.map((l) => [l.id, l]));

  const prods = await tx
    .select({ id: product.id, name: product.name, uom: product.uom, active: product.active })
    .from(product)
    .where(and(eq(product.organizationId, orgId), inArray(product.id, prodIds)));
  const prodById = new Map(prods.map((p) => [p.id, p]));

  for (const m of moves) {
    const src = locById.get(m.sourceLocationId);
    const dst = locById.get(m.destLocationId);
    const prod = prodById.get(m.productId);
    if (!prod) throw new AppError("Product not found");
    if (!prod.active) throw new AppError(`“${prod.name}” is archived`);
    if (!src || !dst) throw new AppError("Location not found");
    if (!src.active || !dst.active) throw new AppError("One of the locations is archived");
    if (src.type === "view" || dst.type === "view") throw new AppError("Choose a storage location, not a warehouse");
    if (src.id === dst.id) throw new AppError("Source and destination must differ");
    if (!(m.quantity > 0)) throw new AppError("Quantity must be greater than 0");
  }

  // Consistent lock order avoids deadlocks between concurrent operations.
  const ordered = [...moves].sort((a, b) =>
    `${a.productId}${a.sourceLocationId}`.localeCompare(`${b.productId}${b.sourceLocationId}`),
  );

  for (const m of ordered) {
    const src = locById.get(m.sourceLocationId)!;
    const dst = locById.get(m.destLocationId)!;
    const q = roundQty(m.quantity);

    if (src.type === "internal") {
      const [dec] = await tx
        .update(stockQuant)
        .set({ quantity: sql`${stockQuant.quantity} - ${q}::numeric` })
        .where(
          and(
            eq(stockQuant.productId, m.productId),
            eq(stockQuant.locationId, m.sourceLocationId),
            sql`${stockQuant.quantity} >= ${q}::numeric`,
          ),
        )
        .returning({ id: stockQuant.id });
      if (!dec) {
        const have = await tx.query.stockQuant.findFirst({
          where: and(eq(stockQuant.productId, m.productId), eq(stockQuant.locationId, m.sourceLocationId)),
          columns: { quantity: true },
        });
        const prod = prodById.get(m.productId)!;
        throw new AppError(
          `Not enough “${prod.name}” in ${src.fullName}: ${have?.quantity ?? 0} ${prod.uom} available, ${q} requested`,
        );
      }
    }

    if (dst.type === "internal") {
      await tx
        .insert(stockQuant)
        .values({ id: newId(), organizationId: orgId, productId: m.productId, locationId: m.destLocationId, quantity: q })
        .onConflictDoUpdate({
          target: [stockQuant.productId, stockQuant.locationId],
          set: { quantity: sql`${stockQuant.quantity} + excluded.quantity`, updatedAt: new Date() },
        });
    }
  }
}

async function createDoneOperation(
  tx: Tx,
  orgId: string,
  userId: string,
  op: { type: OperationType; source: string; dest: string; partner?: string | null; note?: string | null },
  moves: MoveSpec[],
) {
  await applyMoves(tx, orgId, moves);
  const now = new Date();
  const opId = newId();
  const reference = await nextReference(tx, orgId, op.type);
  await tx.insert(operation).values({
    id: opId,
    organizationId: orgId,
    reference,
    type: op.type,
    state: "done",
    sourceLocationId: op.source,
    destLocationId: op.dest,
    partner: op.partner ?? null,
    note: op.note ?? null,
    createdById: userId,
    validatedById: userId,
    validatedAt: now,
  });
  await tx.insert(stockMove).values(
    moves.map((m) => ({
      id: newId(),
      organizationId: orgId,
      operationId: opId,
      ...m,
      quantity: roundQty(m.quantity),
      state: "done" as const,
      doneAt: now,
    })),
  );
  return { id: opId, reference };
}

// Reason → virtual counterpart location and operation type (Odoo semantics).
const COUNTERPART: Record<string, { key: SystemLocationKey; type: OperationType }> = {
  restock: { key: "vendor", type: "receipt" },
  return: { key: "customer", type: "receipt" },
  found: { key: "inventory", type: "adjustment" },
  correction: { key: "inventory", type: "adjustment" },
  sale: { key: "customer", type: "delivery" },
  use: { key: "customer", type: "delivery" },
  damaged: { key: "scrap", type: "scrap" },
  lost: { key: "inventory", type: "adjustment" },
};

async function assertInternal(tx: Tx, orgId: string, locationId: string) {
  const loc = await tx.query.location.findFirst({
    where: and(eq(location.id, locationId), eq(location.organizationId, orgId)),
    columns: { type: true, active: true },
  });
  if (!loc || loc.type !== "internal" || !loc.active) throw new AppError("Choose a storage location");
}

/** Quick "+ add" / "− subtract" an amount at a location, recorded as a validated operation. */
export async function adjustStockTx(tx: Tx, orgId: string, userId: string, input: StockAdjustInput) {
  await assertInternal(tx, orgId, input.locationId);
  const cp = COUNTERPART[input.reason];
  const virtual = await getSystemLocationId(tx, orgId, cp.key);
  const [source, dest] = input.direction === "add" ? [virtual, input.locationId] : [input.locationId, virtual];
  const note = [input.note, `Reason: ${input.reason}`].filter(Boolean).join(" · ");
  return createDoneOperation(
    tx,
    orgId,
    userId,
    { type: cp.type, source, dest, partner: input.partner, note },
    [{ productId: input.productId, sourceLocationId: source, destLocationId: dest, quantity: input.amount }],
  );
}

export function adjustStock(db: DB, orgId: string, userId: string, input: StockAdjustInput) {
  return db.transaction((tx) => adjustStockTx(tx, orgId, userId, input));
}

/** Moves stock between two storage locations (e.g. Shelf A → Shelf B). */
export function transferStock(db: DB, orgId: string, userId: string, input: TransferInput) {
  return db.transaction(async (tx) => {
    await assertInternal(tx, orgId, input.fromLocationId);
    await assertInternal(tx, orgId, input.toLocationId);
    return createDoneOperation(
      tx,
      orgId,
      userId,
      { type: "internal", source: input.fromLocationId, dest: input.toLocationId, note: input.note },
      [
        {
          productId: input.productId,
          sourceLocationId: input.fromLocationId,
          destLocationId: input.toLocationId,
          quantity: input.amount,
        },
      ],
    );
  });
}

/** Physical count: records the difference against the system quantity as an adjustment. */
export function applyCount(db: DB, orgId: string, userId: string, input: CountInput) {
  return db.transaction(async (tx) => {
    await assertInternal(tx, orgId, input.locationId);
    const quant = await tx.query.stockQuant.findFirst({
      where: and(eq(stockQuant.productId, input.productId), eq(stockQuant.locationId, input.locationId)),
      columns: { quantity: true },
    });
    const diff = roundQty(input.countedQuantity - (quant?.quantity ?? 0));
    if (diff === 0) return null;
    const virtual = await getSystemLocationId(tx, orgId, "inventory");
    const [source, dest] = diff > 0 ? [virtual, input.locationId] : [input.locationId, virtual];
    return createDoneOperation(
      tx,
      orgId,
      userId,
      { type: "adjustment", source, dest, note: [input.note, "Physical count"].filter(Boolean).join(" · ") },
      [{ productId: input.productId, sourceLocationId: source, destLocationId: dest, quantity: Math.abs(diff) }],
    );
  });
}

// ---------- Multi-line operations (receipts, deliveries, internal transfers) ----------

/** Creates a draft operation; stock changes only when it is validated. */
export async function createOperation(db: DB, orgId: string, userId: string, input: OperationInput) {
  return db.transaction(async (tx) => {
    let source = input.sourceLocationId;
    let dest = input.destLocationId;
    if (input.type === "receipt") source = await getSystemLocationId(tx, orgId, "vendor");
    if (input.type === "delivery") dest = await getSystemLocationId(tx, orgId, "customer");
    if (!source || !dest) throw new AppError("Choose the locations for this operation");
    if (input.type !== "delivery") await assertInternal(tx, orgId, dest);
    if (input.type !== "receipt") await assertInternal(tx, orgId, source);
    if (source === dest) throw new AppError("Source and destination must differ");

    const productIds = [...new Set(input.lines.map((l) => l.productId))];
    const found = await tx
      .select({ id: product.id })
      .from(product)
      .where(and(eq(product.organizationId, orgId), inArray(product.id, productIds), eq(product.active, true)));
    if (found.length !== productIds.length) throw new AppError("One of the products was not found");

    const opId = newId();
    const reference = await nextReference(tx, orgId, input.type);
    await tx.insert(operation).values({
      id: opId,
      organizationId: orgId,
      reference,
      type: input.type,
      state: "draft",
      sourceLocationId: source,
      destLocationId: dest,
      partner: input.partner,
      note: input.note,
      createdById: userId,
    });
    await tx.insert(stockMove).values(
      input.lines.map((l) => ({
        id: newId(),
        organizationId: orgId,
        operationId: opId,
        productId: l.productId,
        sourceLocationId: source!,
        destLocationId: dest!,
        quantity: roundQty(l.quantity),
        state: "draft" as const,
      })),
    );
    return { id: opId, reference };
  });
}

export async function validateOperation(db: DB, orgId: string, userId: string, operationId: string) {
  await db.transaction(async (tx) => {
    // Lock the operation row so a double-click cannot validate it twice.
    const [op] = await tx
      .select()
      .from(operation)
      .where(and(eq(operation.id, operationId), eq(operation.organizationId, orgId)))
      .for("update");
    if (!op) throw new AppError("Operation not found");
    if (op.state !== "draft") throw new AppError(`This operation is already ${op.state}`);
    const moves = await tx
      .select()
      .from(stockMove)
      .where(eq(stockMove.operationId, operationId))
      .orderBy(asc(stockMove.createdAt));
    await applyMoves(tx, orgId, moves);
    const now = new Date();
    await tx
      .update(stockMove)
      .set({ state: "done", doneAt: now })
      .where(eq(stockMove.operationId, operationId));
    await tx
      .update(operation)
      .set({ state: "done", validatedAt: now, validatedById: userId })
      .where(eq(operation.id, operationId));
  });
}

export async function cancelOperation(db: DB, orgId: string, operationId: string) {
  await db.transaction(async (tx) => {
    const [op] = await tx
      .select({ state: operation.state })
      .from(operation)
      .where(and(eq(operation.id, operationId), eq(operation.organizationId, orgId)))
      .for("update");
    if (!op) throw new AppError("Operation not found");
    if (op.state !== "draft") throw new AppError("Only draft operations can be cancelled");
    await tx.update(stockMove).set({ state: "cancelled" }).where(eq(stockMove.operationId, operationId));
    await tx.update(operation).set({ state: "cancelled" }).where(eq(operation.id, operationId));
  });
}
