import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CenteredShell } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { WorkspaceForm } from "@/components/forms/workspace-form";
import { getContext } from "@/server/context";

export const metadata: Metadata = { title: "Create a workspace" };

export default async function OnboardingPage() {
  const ctx = await getContext();
  if (!ctx) redirect("/sign-in");
  const addingAnother = Boolean(ctx.org);
  return (
    <CenteredShell wide>
      <div className="card p-6">
        <h1 className="text-xl font-semibold tracking-tight">
          {addingAnother ? "Create another workspace" : `Welcome, ${ctx.user.name.split(" ")[0]}`}
        </h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          A workspace holds your products, warehouses and team. If a teammate invited you, open the invitation link
          they sent you instead.
        </p>
        <WorkspaceForm />
      </div>
      <div className="mt-4 flex justify-center gap-2">
        {addingAnother ? (
          <a href="/dashboard" className="btn-ghost btn-sm">
            Back to dashboard
          </a>
        ) : null}
        <SignOutButton className="btn-ghost btn-sm" />
      </div>
    </CenteredShell>
  );
}
