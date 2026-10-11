"use client";

import { saveReorderRuleAction } from "@/app/actions";
import { FormMessage, SubmitButton, useResetOnSuccess, useServerForm } from "../ui";

export function ReorderForm({
  productId,
  uom,
  locations,
}: {
  productId: string;
  uom: string;
  locations: { id: string; fullName: string }[];
}) {
  const { state, pending, formProps } = useServerForm(saveReorderRuleAction);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} {...formProps} className="flex flex-col gap-3">
      <input type="hidden" name="productId" value={productId} />
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <div className="field">
          <label htmlFor="rr-loc" className="label">Location</label>
          <select id="rr-loc" name="locationId" className="input">
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rr-min" className="label">Min ({uom})</label>
          <input id="rr-min" name="minQuantity" type="number" min={0} step="any" inputMode="decimal" required className="input" />
        </div>
        <div className="field">
          <label htmlFor="rr-max" className="label">Max ({uom})</label>
          <input id="rr-max" name="maxQuantity" type="number" min={0} step="any" inputMode="decimal" required className="input" />
        </div>
        <SubmitButton pending={pending} className="btn-secondary">Save rule</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
