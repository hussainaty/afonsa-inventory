import { and, asc, eq, gt } from "drizzle-orm";
import { UserMinus } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { cancelInvitationAction, removeMemberAction, updateMemberRoleAction } from "@/app/actions";
import { ActionButton } from "@/components/forms/action-button";
import { CopyLink, InviteForm } from "@/components/forms/invite-form";
import { PageHeader } from "@/components/layout-bits";
import { db } from "@/db";
import { invitation, member, user } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { canManage, requirePageContext } from "@/server/context";

export const metadata: Metadata = { title: "Team" };

const ROLE_HELP: Record<string, string> = {
  owner: "Full control, including the team",
  admin: "Manage products, locations, categories and team",
  member: "View everything, add products and move stock",
};

export default async function TeamPage() {
  const ctx = await requirePageContext();
  const manager = canManage(ctx.role);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;

  const [members, invites] = await Promise.all([
    db
      .select({ id: member.id, role: member.role, userId: user.id, name: user.name, email: user.email, joined: member.createdAt })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.organizationId, ctx.org.id))
      .orderBy(asc(user.name)),
    manager
      ? db
          .select()
          .from(invitation)
          .where(
            and(
              eq(invitation.organizationId, ctx.org.id),
              eq(invitation.status, "pending"),
              gt(invitation.expiresAt, new Date()),
            ),
          )
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Team" description={`People who can access ${ctx.org.name}.`} />

      {manager ? (
        <section className="card mb-6 p-5" aria-labelledby="invite-heading">
          <h2 id="invite-heading" className="section-title">Invite someone</h2>
          <p className="mb-4 text-sm text-muted">You get a link to share. It expires in 7 days.</p>
          <InviteForm />
        </section>
      ) : null}

      <section className="card mb-6 overflow-hidden" aria-labelledby="members-heading">
        <h2 id="members-heading" className="section-title border-b border-border px-4 py-3">
          Members ({members.length})
        </h2>
        <ul>
          {members.map((m) => {
            const editable = manager && m.role !== "owner" && m.userId !== ctx.user.id;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent" aria-hidden>
                  {m.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.name}
                    {m.userId === ctx.user.id ? <span className="text-muted"> (you)</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted">{m.email}</p>
                </div>
                {editable ? (
                  <div className="flex items-center gap-2">
                    <ActionButton
                      action={updateMemberRoleAction}
                      fields={{ id: m.id, role: m.role === "admin" ? "member" : "admin" }}
                      className="btn-secondary btn-sm"
                      showMessage={false}
                    >
                      Make {m.role === "admin" ? "member" : "admin"}
                    </ActionButton>
                    <ActionButton
                      action={removeMemberAction}
                      fields={{ id: m.id }}
                      className="btn-danger btn-sm size-9 px-0"
                      confirm={`Remove ${m.name} from ${ctx.org.name}?`}
                      showMessage={false}
                    >
                      <UserMinus className="size-4" aria-label={`Remove ${m.name}`} />
                    </ActionButton>
                  </div>
                ) : null}
                <span className="badge bg-surface-2 text-text capitalize" title={ROLE_HELP[m.role]}>
                  {m.role}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {manager && invites.length > 0 ? (
        <section className="card overflow-hidden" aria-labelledby="pending-heading">
          <h2 id="pending-heading" className="section-title border-b border-border px-4 py-3">Pending invitations</h2>
          <ul>
            {invites.map((inv) => (
              <li key={inv.id} className="flex flex-col gap-2 border-b border-border px-4 py-3 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm">
                    <span className="font-medium">{inv.email}</span>{" "}
                    <span className="text-muted capitalize">· {inv.role ?? "member"} · expires {formatDateTime(inv.expiresAt)}</span>
                  </p>
                  <ActionButton action={cancelInvitationAction} fields={{ id: inv.id }} className="btn-ghost btn-sm" showMessage={false}>
                    Cancel
                  </ActionButton>
                </div>
                <CopyLink link={`${origin}/invite/${inv.id}`} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
