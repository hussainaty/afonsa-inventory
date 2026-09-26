import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { acceptInvitationAction } from "@/app/actions";
import { CenteredShell } from "@/components/brand";
import { ActionButton } from "@/components/forms/action-button";
import { SignOutButton } from "@/components/sign-out-button";
import { db } from "@/db";
import { invitation, organization } from "@/db/schema";
import { getContext } from "@/server/context";

export const metadata: Metadata = { title: "Join workspace" };

export default async function InvitePage({ params }: PageProps<"/invite/[id]">) {
  const { id } = await params;
  const ctx = await getContext();
  const [inv] = await db
    .select({ id: invitation.id, email: invitation.email, status: invitation.status, expiresAt: invitation.expiresAt, orgName: organization.name })
    .from(invitation)
    .innerJoin(organization, eq(organization.id, invitation.organizationId))
    .where(eq(invitation.id, id));

  const valid = inv && inv.status === "pending" && inv.expiresAt > new Date();
  const next = encodeURIComponent(`/invite/${id}`);

  return (
    <CenteredShell wide>
      <div className="card p-6">
        {!valid ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight">Invitation unavailable</h1>
            <p className="mt-2 text-sm text-muted">
              This invitation link is invalid, expired or already used. Ask the person who invited you for a new link.
            </p>
            <Link href="/" className="btn-secondary mt-6">
              Go to the app
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight">Join {inv.orgName}</h1>
            <p className="mt-2 text-sm text-muted">
              You’ve been invited as <span className="font-medium text-text">{inv.email}</span>.
            </p>
            {!ctx ? (
              <div className="mt-6 flex flex-col gap-2">
                <Link href={`/sign-up?next=${next}`} className="btn-primary">
                  Create an account with {inv.email}
                </Link>
                <Link href={`/sign-in?next=${next}`} className="btn-secondary">
                  I already have an account
                </Link>
              </div>
            ) : ctx.user.email.toLowerCase() !== inv.email.toLowerCase() ? (
              <div className="mt-6 flex flex-col gap-3">
                <p role="alert" className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
                  You’re signed in as {ctx.user.email}. Sign out and sign in with {inv.email} to accept.
                </p>
                <SignOutButton className="btn-secondary" />
              </div>
            ) : (
              <div className="mt-6">
                <ActionButton action={acceptInvitationAction} fields={{ id }} className="btn-primary w-full" pendingText="Joining…">
                  Accept and join
                </ActionButton>
              </div>
            )}
          </>
        )}
      </div>
    </CenteredShell>
  );
}
