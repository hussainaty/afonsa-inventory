"use client";

import { useActionState } from "react";
import {
  createLocationAction,
  createWarehouseAction,
  renameLocationAction,
  type ActionState,
} from "@/app/actions";
import { FormMessage, SubmitButton, useResetOnSuccess } from "../ui";

export function NewLocationForm({
  parents,
  defaultParentId,
}: {
  parents: { id: string; fullName: string }[];
  defaultParentId?: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(createLocationAction, {});
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="field">
          <label htmlFor="loc-parent" className="label">Inside</label>
          <select id="loc-parent" name="parentId" defaultValue={defaultParentId} className="input">
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="loc-name" className="label">Section name</label>
          <input id="loc-name" name="name" required maxLength={60} placeholder="e.g. Shelf A, Aisle 3, Bin 12" className="input" />
        </div>
        <SubmitButton>Add section</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function NewWarehouseForm() {
  const [state, action] = useActionState<ActionState, FormData>(createWarehouseAction, {});
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <div className="field">
          <label htmlFor="wh-name" className="label">Warehouse / site name</label>
          <input id="wh-name" name="name" required maxLength={60} placeholder="e.g. Downtown Store" className="input" />
        </div>
        <div className="field">
          <label htmlFor="wh-code" className="label">Short code</label>
          <input id="wh-code" name="code" required maxLength={8} placeholder="e.g. DT" className="input font-mono uppercase" autoCapitalize="characters" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="wh-address" className="label">Address (optional)</label>
        <input id="wh-address" name="address" maxLength={300} className="input" />
      </div>
      <FormMessage state={state} />
      <div>
        <SubmitButton className="btn-secondary">Add warehouse</SubmitButton>
      </div>
    </form>
  );
}

export function RenameLocationForm({ id, name }: { id: string; name: string }) {
  const [state, action] = useActionState<ActionState, FormData>(renameLocationAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex gap-2">
        <label htmlFor={`rename-${id}`} className="sr-only">New name</label>
        <input id={`rename-${id}`} name="name" defaultValue={name} required maxLength={60} className="input" />
        <SubmitButton className="btn-secondary">Rename</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
