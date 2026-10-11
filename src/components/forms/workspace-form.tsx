"use client";

import { createWorkspaceAction } from "@/app/actions";
import { FormMessage, SubmitButton, useServerForm } from "../ui";

export function WorkspaceForm() {
  const { state, pending, formProps } = useServerForm(createWorkspaceAction);
  return (
    <form {...formProps} className="flex flex-col gap-4">
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
      <SubmitButton pending={pending} pendingText="Creating…">Create workspace</SubmitButton>
    </form>
  );
}
