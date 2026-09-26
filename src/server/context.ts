import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { member, organization } from "@/db/schema";
import { auth } from "@/lib/auth";
import { AppError } from "./common";
import { ensureWorkspaceSetup } from "./locations";

export type Role = "owner" | "admin" | "member";

const setUpOrgs = new Set<string>();

/** Session + active workspace for the current request, or null when signed out. */
export const getContext = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const memberships = await db
    .select({ orgId: organization.id, name: organization.name, slug: organization.slug, role: member.role })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, session.user.id))
    .orderBy(asc(organization.name));

  // Membership is always re-checked here: the session's active org alone is not trusted.
  const active =
    memberships.find((m) => m.orgId === session.session.activeOrganizationId) ?? memberships[0] ?? null;

  if (active && !setUpOrgs.has(active.orgId)) {
    await ensureWorkspaceSetup(db, active.orgId);
    setUpOrgs.add(active.orgId);
  }

  return {
    user: session.user,
    session: session.session,
    memberships,
    org: active ? { id: active.orgId, name: active.name, slug: active.slug } : null,
    role: (active?.role ?? null) as Role | null,
  };
});

export type Context = NonNullable<Awaited<ReturnType<typeof getContext>>>;
export type OrgContext = Context & { org: NonNullable<Context["org"]>; role: Role };

/** For pages: redirects to sign-in / onboarding instead of throwing. */
export async function requirePageContext(): Promise<OrgContext> {
  const ctx = await getContext();
  if (!ctx) redirect("/sign-in");
  if (!ctx.org || !ctx.role) redirect("/onboarding");
  return ctx as OrgContext;
}

/** For server actions: throws a user-safe error. */
export async function requireActionContext(): Promise<OrgContext> {
  const ctx = await getContext();
  if (!ctx) throw new AppError("Your session has expired. Please sign in again.");
  if (!ctx.org || !ctx.role) throw new AppError("Create or join a workspace first.");
  return ctx as OrgContext;
}

export const canManage = (role: Role | null) => role === "owner" || role === "admin";

export function requireManager(ctx: OrgContext) {
  if (!canManage(ctx.role)) throw new AppError("Only workspace owners and admins can do this.");
}

export async function isMember(userId: string, orgId: string) {
  const row = await db.query.member.findFirst({
    where: and(eq(member.userId, userId), eq(member.organizationId, orgId)),
    columns: { id: true },
  });
  return Boolean(row);
}
