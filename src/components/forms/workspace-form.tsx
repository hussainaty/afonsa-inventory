"use client";

import { useActionState } from "react";
import { createWorkspaceAction, type ActionState } from "@/app/actions";
import { FormMessage, SubmitButton } from "../ui";

export function WorkspaceForm() {
  const [state, action] = useActionState<ActionState, FormData>(createWorkspaceAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="field">
        <label htmlFor="ws-name" className="label">
          Workspace name
        </label>
        <input
          id="ws-name"
          name="name"
          required
          minLength={2}
          maxLength={60}
          placeholder="e.g. Afonsa Store"
          className="input"
        />
        <p className="hint">Usually your business or team name. A “Main Warehouse” is created for you.</p>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Creating…">Create workspace</SubmitButton>
    </form>
  );
}
