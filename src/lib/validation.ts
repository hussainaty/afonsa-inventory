import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const requiredText = (label: string, max: number) =>
  z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`).max(max);

/** Positive quantity with up to 4 decimals (e.g. 2.5 kg). */
export const quantity = z.coerce
  .number({ error: "Enter a number" })
  .finite("Enter a number")
  .gt(0, "Amount must be greater than 0")
  .max(1_000_000_000, "Amount is too large")
  .refine((n) => Math.abs(n * 10_000 - Math.round(n * 10_000)) < 1e-6, "Use at most 4 decimals");

const nonNegativeQty = z.coerce.number().finite().min(0, "Cannot be negative").max(1_000_000_000);

const money = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000) {
      ctx.addIssue({ code: "custom", message: "Enter a valid price" });
      return z.NEVER;
    }
    return Math.round(n * 100);
  });

export const categoryInput = z.object({
  name: requiredText("Name", 60).refine((v) => !v.includes("/"), "Names cannot contain “/”"),
  parentId: optionalText(64),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Pick a valid color")
    .default("#64748b"),
  description: optionalText(300),
});
export type CategoryInput = z.infer<typeof categoryInput>;

export const productInput = z.object({
  name: requiredText("Name", 120),
  variant: optionalText(60),
  categoryId: optionalText(64),
  sku: optionalText(64),
  barcode: optionalText(64),
  uom: requiredText("Unit", 20).default("pcs"),
  cost: money,
  salePrice: money,
  description: optionalText(2000),
});
export type ProductInput = z.infer<typeof productInput>;

/** Product creation can also record the opening stock in a location. */
export const newProductInput = productInput.extend({
  initialQuantity: nonNegativeQty.default(0),
  initialLocationId: optionalText(64),
});
export type NewProductInput = z.infer<typeof newProductInput>;

export const ADD_REASONS = ["restock", "return", "found", "correction"] as const;
export const SUBTRACT_REASONS = ["sale", "use", "damaged", "lost", "correction"] as const;

export const REASON_LABELS: Record<string, string> = {
  restock: "Restock / purchase",
  return: "Customer return",
  found: "Found / count gain",
  correction: "Correction",
  sale: "Sale / delivery",
  use: "Internal use",
  damaged: "Damaged / scrap",
  lost: "Lost / count loss",
};

export const stockAdjustInput = z.discriminatedUnion("direction", [
  z.object({
    direction: z.literal("add"),
    productId: requiredText("Product", 64),
    locationId: requiredText("Location", 64),
    amount: quantity,
    reason: z.enum(ADD_REASONS).default("restock"),
    partner: optionalText(120),
    note: optionalText(500),
  }),
  z.object({
    direction: z.literal("subtract"),
    productId: requiredText("Product", 64),
    locationId: requiredText("Location", 64),
    amount: quantity,
    reason: z.enum(SUBTRACT_REASONS).default("sale"),
    partner: optionalText(120),
    note: optionalText(500),
  }),
]);
export type StockAdjustInput = z.infer<typeof stockAdjustInput>;

export const transferInput = z
  .object({
    productId: requiredText("Product", 64),
    fromLocationId: requiredText("From location", 64),
    toLocationId: requiredText("To location", 64),
    amount: quantity,
    note: optionalText(500),
  })
  .refine((v) => v.fromLocationId !== v.toLocationId, {
    message: "Choose two different locations",
    path: ["toLocationId"],
  });
export type TransferInput = z.infer<typeof transferInput>;

export const countInput = z.object({
  productId: requiredText("Product", 64),
  locationId: requiredText("Location", 64),
  countedQuantity: nonNegativeQty,
  note: optionalText(500),
});
export type CountInput = z.infer<typeof countInput>;

export const operationLineInput = z.object({ productId: requiredText("Product", 64), quantity });

export const operationInput = z.object({
  type: z.enum(["receipt", "delivery", "internal"]),
  sourceLocationId: optionalText(64),
  destLocationId: optionalText(64),
  partner: optionalText(120),
  note: optionalText(500),
  lines: z.array(operationLineInput).min(1, "Add at least one product").max(200),
});
export type OperationInput = z.infer<typeof operationInput>;

export const warehouseInput = z.object({
  name: requiredText("Name", 60),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,8}$/, "Code must be 1–8 letters or digits"),
  address: optionalText(300),
});

export const locationInput = z.object({
  parentId: requiredText("Parent location", 64),
  name: requiredText("Name", 60),
  barcode: optionalText(64),
});

export const reorderRuleInput = z
  .object({
    productId: requiredText("Product", 64),
    locationId: requiredText("Location", 64),
    minQuantity: nonNegativeQty,
    maxQuantity: nonNegativeQty,
  })
  .refine((v) => v.maxQuantity >= v.minQuantity, {
    message: "Maximum must be at least the minimum",
    path: ["maxQuantity"],
  });
export type ReorderRuleInput = z.infer<typeof reorderRuleInput>;

export const workspaceInput = z.object({
  name: requiredText("Workspace name", 60).refine((v) => v.length >= 2, "Name must be at least 2 characters"),
});

export const inviteInput = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(["member", "admin"]).default("member"),
});

export function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "workspace"}-${Math.random().toString(36).slice(2, 8)}`;
}
