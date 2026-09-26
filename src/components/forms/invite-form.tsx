"use client";

import { Check, Copy } from "lucide-react";
import { useActionState, useState } from "react";
import { inviteMemberAction, type ActionState } from "@/app/actions";
import { FormMessage, SubmitButton } from "../ui";

export function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <label className="sr-only" htmlFor={`link-${link}`}>Invitation link</label>
      <input id={`link-${link}`} readOnly value={link} className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        className="btn-secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {}
        }}
      >
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function InviteForm() {
  const [state, action] = useActionState<ActionState, FormData>(inviteMemberAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <div className="field">
          <label htmlFor="inv-email" className="label">Email</label>
          <input id="inv-email" name="email" type="email" required className="input" inputMode="email" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="inv-role" className="label">Role</label>
          <select id="inv-role" name="role" className="input" defaultValue="member">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <SubmitButton>Create invite</SubmitButton>
      </div>
      <FormMessage state={state} />
      {state.data?.link ? (
        <div className="flex flex-col gap-1.5">
          <p className="hint">Send this link to them (WhatsApp, email, …). They sign up with that email and join.</p>
          <CopyLink link={state.data.link} />
        </div>
      ) : null}
    </form>
  );
}
