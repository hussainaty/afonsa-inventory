"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import {
  categoryInput,
  countInput,
  firstError,
  formToObject,
  inviteInput,
  locationInput,
  newProductInput,
  newSizeStockInput,
  operationInput,
  productInput,
  reorderRuleInput,
  slugify,
  stockAdjustInput,
  transferInput,
  warehouseInput,
  workspaceInput,
} from "@/lib/validation";
import * as catalog from "@/server/catalog";
import * as images from "@/server/images";
import { getStorage } from "@/server/storage";
import { AppError } from "@/server/common";
import { isMember, requireActionContext, requireManager } from "@/server/context";
import * as locations from "@/server/locations";
import * as reports from "@/server/reports";
import * as stock from "@/server/stock";

export type ActionState = { ok?: boolean; error?: string; message?: string; data?: Record<string, string> };

/** Converts expected failures into form state; unexpected ones are logged and hidden. */
async function run(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await fn();
    return { ok: true, message: message ?? undefined };
  } catch (err) {
    if (err instanceof AppError) return { error: err.message };
    if (err instanceof z.ZodError) return { error: firstError(err) };
    const apiMessage = (err as { body?: { message?: string } })?.body?.message;
    if (apiMessage) return { error: apiMessage };
    console.error("[action]", err);
    return { error: "Something went wrong. Please try again." };
  }
}

const idOf = (form: FormData, key = "id") => {
  const v = form.get(key);
  if (typeof v !== "string" || !v) throw new AppError("Missing identifier");
  return v;
};

function refreshApp() {
  revalidatePath("/", "layout");
}

// ---------- Workspaces ----------

export async function createWorkspaceAction(_: ActionState, form: FormData): Promise<ActionState> {
  let created = false;
  const state = await run(async () => {
    const h = await headers();
    const session = await auth.api.getSession({ headers: h });
    if (!session) throw new AppError("Please sign in again.");
    const { name } = workspaceInput.parse(formToObject(form));
    const org = await auth.api.createOrganization({ body: { name, slug: slugify(name) }, headers: h });
    if (!org) throw new AppError("Could not create the workspace");
    await locations.ensureWorkspaceSetup(db, org.id);
    await auth.api.setActiveOrganization({ body: { organizationId: org.id }, headers: h });
    created = true;
  });
  if (created) redirect("/dashboard");
  return state;
}

export async function switchWorkspaceAction(form: FormData) {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  const orgId = form.get("organizationId");
  if (!session || typeof orgId !== "string" || !(await isMember(session.user.id, orgId))) redirect("/dashboard");
  await auth.api.setActiveOrganization({ body: { organizationId: orgId }, headers: h });
  redirect("/dashboard");
}

// ---------- Categories ----------

export async function saveCategoryAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireActionContext();
    requireManager(ctx);
    const input = categoryInput.parse(formToObject(form));
    const id = form.get("id");
    if (typeof id === "string" && id) await catalog.updateCategory(db, ctx.org.id, id, input);
    else await catalog.createCategory(db, ctx.org.id, input);
    refreshApp();
    return "Category saved";
  });
}

export async function deleteCategoryAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireActionContext();
    requireManager(ctx);
    await catalog.deleteCategory(db, ctx.org.id, idOf(form));
    refreshApp();
    return "Category deleted";
  });
}

// ---------- Products ----------

export async function createProductAction(_: ActionState, form: FormData): Promise<ActionState> {
  let newId: string | null = null;
  const state = await run(async () => {
    const ctx = await requireActionContext();
    const input = newProductInput.parse(formToObject(form));
    const created = await catalog.createProduct(db, ctx.org.id, ctx.user.id, input);
    newId = created.id;
    refreshApp();
  });
  if (newId) redirect(`/products/${newId}?created=1`);
  return state;
}

export async function updateProductAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireActionContext();
    const input = productInput.parse(formToObject(form));
    await catalog.updateProduct(db, ctx.org.id, idOf(form), input);
    refreshApp();
    return "Product saved";
  });
}

export async function setProductActiveAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireActionContext();
    requireManager(ctx);
    const active = form.get("active") === "true";
    await catalog.setProductActive(db, ctx.org.id, idOf(form), active);
    refreshApp();
    return active ? "Product restored" : "Product archived";
  });
}

export async function deleteProductAction(_: ActionState, form: FormData): Promise<ActionState> {
  let deleted = false;
  const state = await run(async () => {
    const ctx = await requireActionContext();
    requireManager(ctx);
    const productId = idOf(form);
    const keys = await images.productImageKeys(db, ctx.org.id, productId);
    await catalog.deleteProduct(db, ctx.org.id, productId);
    const storage = getStorage();
    await Promise.all(keys.map((k) => storage.delete(k).catch(() => {})));
    deleted = true;
    refreshApp();
  });
  if (deleted) redirect("/products");
  return state;
}

export async function deleteImageAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireActionContext();
    await images.deleteProductImage(db, getStorage(), ctx.org.id, idOf(form));
    refreshApp();
    return "Photo deleted";
  });
}

export async function makeMainImageAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireActionContext();
    await images.makeMainImage(db, ctx.org.id, idOf(form));
    refreshApp();
    return "Main photo updated";
  });
}

export async function findByCodeAction(code: string): Promise<string | null> {
  const ctx = await requireActionContext();
  const found = await catalog.findProductByCode(db, ctx.org.id, String(code).slice(0, 64));
  return found?.id ?? null;
}

// ---------- Stock ----------

export async function adjustStockAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireActionContext();
    const input = stockAdjustInput.parse(formToObject(form));
    const op = await stock.adjustStock(db, ctx.org.id, ctx.user.id, input);
    refreshApp();
    return `${input.direction === "add" ? "Added" : "Subtracted"} ${input.amount} · ${op.reference}`;
  });
}

export async function addStockNewSizeAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireActionContext();
    const input = newSizeStockInput.parse(formToObject(form));
    const res = await catalog.addStockToNewSize(db, ctx.org.id, ctx.user.id, input);
    refreshApp();
    return `Added ${input.amount} of new size ${input.variant} · ${res.reference}`;
  });
}

export async function transferStockAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireActionContext();
    const input = transferInput.parse(formToObject(form));
    const op = await stock.transferStock(db, ctx.org.id, ctx.user.id, input);
    refreshApp();
    return `Moved ${input.amount} · ${op.reference}`;
  });
}

export async function countStockAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireActionContext();
    const input = countInput.parse(formToObject(form));
    const op = await stock.applyCount(db, ctx.org.id, ctx.user.id, input);
    refreshApp();
    return op ? `Count recorded · ${op.reference}` : "Count matches, nothing to adjust";
  });
}

export async function createOperationAction(_: ActionState, form: FormData): Promise<ActionState> {
  let opId: string | null = null;
  const state = await run(async () => {
    const ctx = await requireActionContext();
    const raw = formToObject(form);
    let lines: unknown;
    try {
      lines = JSON.parse(raw.lines ?? "[]");
    } catch {
      throw new AppError("Invalid product lines");
    }
    const input = operationInput.parse({ ...raw, lines });
    const op = await stock.createOperation(db, ctx.org.id, ctx.user.id, input);
    if (raw.validateNow === "true") await stock.validateOperation(db, ctx.org.id, ctx.user.id, op.id);
    opId = op.id;
    refreshApp();
  });
  if (opId) redirect(`/operations/${opId}`);
  return state;
}

export async function validateOperationAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireActionContext();
    await stock.validateOperation(db, ctx.org.id, ctx.user.id, idOf(form));
    refreshApp();
    return "Operation validated";
  });
}

export async function cancelOperationAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireActionContext();
    await stock.cancelOperation(db, ctx.org.id, idOf(form));
    refreshApp();
    return "Operation cancelled";
  });
}

// ---------- Warehouses & locations ----------

export async function createWarehouseAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireActionContext();
    requireManager(ctx);
    await locations.createWarehouse(db, ctx.org.id, warehouseInput.parse(formToObject(form)));
    refreshApp();
    return "Warehouse created";
  });
}

export async function createLocationAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireActionContext();
    requireManager(ctx);
    const loc = await locations.createLocation(db, ctx.org.id, locationInput.parse(formToObject(form)));
    refreshApp();
    return `Created ${loc.fullName}`;
  });
}

export async function renameLocationAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireActionContext();
    requireManager(ctx);
    const name = z.string().trim().min(1, "Name is required").max(60).parse(form.get("name"));
    await locations.renameLocation(db, ctx.org.id, idOf(form), name);
    refreshApp();
    return "Location renamed";
  });
}

export async function archiveLocationAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireActionContext();
    requireManager(ctx);
    await locations.archiveLocation(db, ctx.org.id, idOf(form));
    refreshApp();
    return "Location archived";
  });
}

// ---------- Reordering rules ----------

export async function saveReorderRuleAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireActionContext();
    requireManager(ctx);
    await reports.upsertReorderRule(db, ctx.org.id, reorderRuleInput.parse(formToObject(form)));
    refreshApp();
    return "Reordering rule saved";
  });
}

export async function deleteReorderRuleAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireActionContext();
    requireManager(ctx);
    await reports.deleteReorderRule(db, ctx.org.id, idOf(form));
    refreshApp();
    return "Reordering rule removed";
  });
}

// ---------- Team ----------

export async function inviteMemberAction(_: ActionState, form: FormData): Promise<ActionState> {
  let link = "";
  const state = await run(async () => {
    const ctx = await requireActionContext();
    requireManager(ctx);
    const { email, role } = inviteInput.parse(formToObject(form));
    const inv = await auth.api.createInvitation({
      body: { email, role, organizationId: ctx.org.id, resend: true },
      headers: await headers(),
    });
    const h = await headers();
    const origin = h.get("origin") ?? `https://${h.get("host")}`;
    link = `${origin}/invite/${inv.id}`;
    refreshApp();
    return `Invitation created for ${email}`;
  });
  return link ? { ...state, data: { link } } : state;
}

export async function cancelInvitationAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireActionContext();
    requireManager(ctx);
    await auth.api.cancelInvitation({ body: { invitationId: idOf(form) }, headers: await headers() });
    refreshApp();
    return "Invitation cancelled";
  });
}

export async function updateMemberRoleAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireActionContext();
    requireManager(ctx);
    const role = z.enum(["member", "admin"]).parse(form.get("role"));
    await auth.api.updateMemberRole({
      body: { memberId: idOf(form), role, organizationId: ctx.org.id },
      headers: await headers(),
    });
    refreshApp();
    return "Role updated";
  });
}

export async function removeMemberAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireActionContext();
    requireManager(ctx);
    await auth.api.removeMember({
      body: { memberIdOrEmail: idOf(form), organizationId: ctx.org.id },
      headers: await headers(),
    });
    refreshApp();
    return "Member removed";
  });
}

export async function acceptInvitationAction(_: ActionState, form: FormData): Promise<ActionState> {
  let accepted = false;
  const state = await run(async () => {
    const h = await headers();
    const res = await auth.api.acceptInvitation({ body: { invitationId: idOf(form) }, headers: h });
    if (res?.member?.organizationId) {
      await locations.ensureWorkspaceSetup(db, res.member.organizationId);
      await auth.api.setActiveOrganization({ body: { organizationId: res.member.organizationId }, headers: h });
    }
    accepted = true;
  });
  if (accepted) redirect("/dashboard");
  return state;
}
