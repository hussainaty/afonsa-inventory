import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Every table lives in its own Postgres schema so this app can share a
// database (e.g. the ZAH Supabase project) without touching other tables.
export const inventory = pgSchema("inventory");

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const qty = (name: string) => numeric(name, { precision: 18, scale: 4, mode: "number" });
const orgId = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

// ---------- Better Auth tables (core + organization plugin) ----------

export const user = inventory.table("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = inventory.table(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id"),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = inventory.table(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = inventory.table(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const organization = inventory.table("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  createdAt: createdAt(),
});

export const member = inventory.table(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: orgId(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: createdAt(),
  },
  (t) => [
    index("member_org_idx").on(t.organizationId),
    index("member_user_idx").on(t.userId),
  ],
);

export const invitation = inventory.table(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: orgId(),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [index("invitation_org_idx").on(t.organizationId)],
);

export const authSchema = { user, session, account, verification, organization, member, invitation };

// ---------- Inventory domain (Odoo-style double-entry model) ----------
//
// Every quantity change is a stock_move from one location to another.
// Internal locations hold stock (tracked in stock_quant). Vendor, customer,
// inventory-adjustment and scrap locations are virtual counterparts, so
// "add 5" is a move Vendor -> Shelf and "subtract 2" is Shelf -> Customer.

export const LOCATION_TYPES = ["view", "internal", "vendor", "customer", "inventory", "scrap", "transit"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const warehouse = inventory.table(
  "warehouse",
  {
    id: text("id").primaryKey(),
    organizationId: orgId(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    address: text("address"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("warehouse_org_code_uq").on(t.organizationId, t.code)],
);

export const location = inventory.table(
  "location",
  {
    id: text("id").primaryKey(),
    organizationId: orgId(),
    warehouseId: text("warehouse_id").references(() => warehouse.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    name: text("name").notNull(),
    // Denormalized "WH/Stock/Shelf A" path for display, search and sorting.
    fullName: text("full_name").notNull(),
    type: text("type", { enum: LOCATION_TYPES }).notNull(),
    // Stable key for per-workspace system locations (vendor, customer, ...).
    systemKey: text("system_key"),
    barcode: text("barcode"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("location_org_idx").on(t.organizationId, t.type),
    index("location_parent_idx").on(t.parentId),
    uniqueIndex("location_org_system_uq")
      .on(t.organizationId, t.systemKey)
      .where(sql`${t.systemKey} is not null`),
    uniqueIndex("location_org_fullname_uq").on(t.organizationId, sql`lower(${t.fullName})`),
  ],
);

export const category = inventory.table(
  "category",
  {
    id: text("id").primaryKey(),
    organizationId: orgId(),
    parentId: text("parent_id"),
    name: text("name").notNull(),
    color: text("color").notNull().default("#64748b"),
    description: text("description"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("category_org_name_uq").on(
      t.organizationId,
      sql`coalesce(${t.parentId}, '')`,
      sql`lower(${t.name})`,
    ),
  ],
);

export const product = inventory.table(
  "product",
  {
    id: text("id").primaryKey(),
    organizationId: orgId(),
    categoryId: text("category_id").references(() => category.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    // Size or variant of the same part, e.g. "18 inch". Products sharing a name are sizes of one part.
    variant: text("variant"),
    sku: text("sku"),
    barcode: text("barcode"),
    uom: text("uom").notNull().default("pcs"),
    // Money is stored in minor units (cents) to avoid floating-point errors.
    costCents: integer("cost_cents"),
    salePriceCents: integer("sale_price_cents"),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("product_org_idx").on(t.organizationId, t.active),
    index("product_category_idx").on(t.categoryId),
    uniqueIndex("product_org_name_variant_uq").on(
      t.organizationId,
      sql`lower(${t.name})`,
      sql`lower(coalesce(${t.variant}, ''))`,
    ),
    uniqueIndex("product_org_sku_uq")
      .on(t.organizationId, sql`lower(${t.sku})`)
      .where(sql`${t.sku} is not null`),
    uniqueIndex("product_org_barcode_uq")
      .on(t.organizationId, t.barcode)
      .where(sql`${t.barcode} is not null`),
  ],
);

/** Photos of a product. Files live in object storage; this row holds the key and metadata. */
export const productImage = inventory.table(
  "product_image",
  {
    id: text("id").primaryKey(),
    organizationId: orgId(),
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    // 0 = main photo shown in lists.
    position: integer("position").notNull().default(0),
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("product_image_product_idx").on(t.productId, t.position)],
);

/** On-hand quantity of a product in an internal location. Changed only by validated moves. */
export const stockQuant = inventory.table(
  "stock_quant",
  {
    id: text("id").primaryKey(),
    organizationId: orgId(),
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => location.id, { onDelete: "restrict" }),
    quantity: qty("quantity").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("quant_product_location_uq").on(t.productId, t.locationId),
    index("quant_org_location_idx").on(t.organizationId, t.locationId),
  ],
);

export const OPERATION_TYPES = ["receipt", "delivery", "internal", "adjustment", "scrap"] as const;
export type OperationType = (typeof OPERATION_TYPES)[number];
export const OPERATION_STATES = ["draft", "done", "cancelled"] as const;
export type OperationState = (typeof OPERATION_STATES)[number];

/** A transfer document (Odoo "picking"): IN/00001, OUT/00002, INT/00003 ... */
export const operation = inventory.table(
  "operation",
  {
    id: text("id").primaryKey(),
    organizationId: orgId(),
    reference: text("reference").notNull(),
    type: text("type", { enum: OPERATION_TYPES }).notNull(),
    state: text("state", { enum: OPERATION_STATES }).notNull().default("draft"),
    sourceLocationId: text("source_location_id")
      .notNull()
      .references(() => location.id, { onDelete: "restrict" }),
    destLocationId: text("dest_location_id")
      .notNull()
      .references(() => location.id, { onDelete: "restrict" }),
    partner: text("partner"),
    note: text("note"),
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
    validatedById: text("validated_by_id").references(() => user.id, { onDelete: "set null" }),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("operation_org_ref_uq").on(t.organizationId, t.reference),
    index("operation_org_state_idx").on(t.organizationId, t.state, t.createdAt),
  ],
);

export const stockMove = inventory.table(
  "stock_move",
  {
    id: text("id").primaryKey(),
    organizationId: orgId(),
    operationId: text("operation_id")
      .notNull()
      .references(() => operation.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "restrict" }),
    sourceLocationId: text("source_location_id")
      .notNull()
      .references(() => location.id, { onDelete: "restrict" }),
    destLocationId: text("dest_location_id")
      .notNull()
      .references(() => location.id, { onDelete: "restrict" }),
    quantity: qty("quantity").notNull(),
    state: text("state", { enum: OPERATION_STATES }).notNull().default("draft"),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("move_product_idx").on(t.productId, t.doneAt),
    index("move_operation_idx").on(t.operationId),
    index("move_org_done_idx").on(t.organizationId, t.doneAt),
  ],
);

/** Min/max replenishment rule for a product at a location (Odoo "reordering rule"). */
export const reorderRule = inventory.table(
  "reorder_rule",
  {
    id: text("id").primaryKey(),
    organizationId: orgId(),
    productId: text("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    locationId: text("location_id")
      .notNull()
      .references(() => location.id, { onDelete: "cascade" }),
    minQuantity: qty("min_quantity").notNull().default(0),
    maxQuantity: qty("max_quantity").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("reorder_product_location_uq").on(t.productId, t.locationId)],
);

/** Per-workspace counters for human-readable references (IN/00001). */
export const sequence = inventory.table(
  "sequence",
  {
    organizationId: orgId(),
    code: text("code").notNull(),
    next: bigint("next", { mode: "number" }).notNull().default(1),
  },
  (t) => [uniqueIndex("sequence_org_code_uq").on(t.organizationId, t.code)],
);
