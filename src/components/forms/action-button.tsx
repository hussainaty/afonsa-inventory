"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/app/actions";
import { FormMessage, SubmitButton } from "../ui";

/** A one-button form bound to a server action, with an optional confirm step. */
export function ActionButton({
  action,
  fields,
  children,
  className = "btn-secondary",
  confirm,
  pendingText,
  showMessage = true,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  children: ReactNode;
  className?: string;
  confirm?: string;
  pendingText?: string;
  showMessage?: boolean;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  return (
    <form
      action={formAction}
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton className={className} pendingText={pendingText}>
        {children}
      </SubmitButton>
      {showMessage ? <FormMessage state={state} /> : null}
    </form>
  );
}
