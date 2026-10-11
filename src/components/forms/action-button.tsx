"use client";

import type { ReactNode } from "react";
import type { ActionState } from "@/app/actions";
import { FormMessage, SubmitButton, useServerForm } from "../ui";

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
  /** Success messages can be hidden for compact buttons; errors are always shown. */
  showMessage?: boolean;
}) {
  const { state, pending, formProps } = useServerForm(action);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) {
          e.preventDefault();
          return;
        }
        formProps.onSubmit(e);
      }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton pending={pending} className={className} pendingText={pendingText}>
        {children}
      </SubmitButton>
      {showMessage || state.error ? <FormMessage state={state} /> : null}
    </form>
  );
}
