"use client";

import { useActionState } from "react";
import { saveCategoryAction, type ActionState } from "@/app/actions";
import { FormMessage, SubmitButton, useResetOnSuccess } from "../ui";

type Cat = { id: string; name: string; parentId: string | null; color: string; description: string | null };

const SWATCHES = ["#0f766e", "#2563eb", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#64748b"];

export function CategoryForm({ category, parents }: { category?: Cat; parents: { id: string; path: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(saveCategoryAction, {});
  const ref = useResetOnSuccess(category ? {} : state);
  const p = category ? `cat-${category.id}` : "cat-new";
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      {category ? <input type="hidden" name="id" value={category.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="field">
          <label htmlFor={`${p}-name`} className="label">Name</label>
          <input id={`${p}-name`} name="name" required maxLength={60} defaultValue={category?.name} className="input" />
        </div>
        <div className="field">
          <label htmlFor={`${p}-parent`} className="label">Parent category</label>
          <select id={`${p}-parent`} name="parentId" defaultValue={category?.parentId ?? ""} className="input">
            <option value="">None (top level)</option>
            {parents
              .filter((c) => c.id !== category?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.path}
                </option>
              ))}
          </select>
        </div>
      </div>
      <fieldset className="field">
        <legend className="label mb-1.5">Color</legend>
        <div className="flex flex-wrap gap-2">
          {SWATCHES.map((c, i) => (
            <label key={c} className="relative">
              <input
                type="radio"
                name="color"
                value={c}
                defaultChecked={category ? category.color === c : i === 0}
                className="peer sr-only"
              />
              <span
                className="block size-9 rounded-full ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-text peer-focus-visible:ring-2 peer-focus-visible:ring-accent"
                style={{ background: c }}
              />
              <span className="sr-only">{c}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor={`${p}-desc`} className="label">Description (optional)</label>
        <input id={`${p}-desc`} name="description" maxLength={300} defaultValue={category?.description ?? ""} className="input" />
      </div>
      <FormMessage state={state} />
      <div>
        <SubmitButton className={category ? "btn-secondary" : "btn-primary"}>{category ? "Save" : "Add category"}</SubmitButton>
      </div>
    </form>
  );
}
