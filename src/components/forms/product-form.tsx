"use client";

import { useActionState } from "react";
import { createProductAction, updateProductAction, type ActionState } from "@/app/actions";
import { centsToInput } from "@/lib/format";
import { Field, FormMessage, SubmitButton } from "../ui";

type Option = { id: string; label: string };

type ProductValues = {
  id?: string;
  name?: string;
  variant?: string | null;
  categoryId?: string | null;
  sku?: string | null;
  barcode?: string | null;
  uom?: string;
  costCents?: number | null;
  salePriceCents?: number | null;
  description?: string | null;
};

const UNITS = ["pcs", "box", "pack", "set", "pair", "kg", "g", "l", "ml", "m", "cm", "roll"];

export function ProductForm({
  mode,
  values = {},
  categories,
  locations,
  defaultLocationId,
}: {
  mode: "create" | "edit";
  values?: ProductValues;
  categories: Option[];
  locations?: Option[];
  defaultLocationId?: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    mode === "create" ? createProductAction : updateProductAction,
    {},
  );
  const f = (name: string) => `product-${name}`;

  return (
    <form action={action} className="flex flex-col gap-6">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="section-title sm:col-span-2">Details</h2>
        <Field label="Name" htmlFor={f("name")} hint="Use the same name for every size of a part.">
          <input id={f("name")} name="name" required maxLength={120} defaultValue={values.name} className="input" />
        </Field>
        <Field label="Size / variant" htmlFor={f("variant")} hint="Optional, e.g. 15 inch, 18 inch, Large.">
          <input
            id={f("variant")}
            name="variant"
            maxLength={60}
            defaultValue={values.variant ?? ""}
            placeholder="e.g. 18 inch"
            className="input"
            autoFocus={Boolean(values.name) && mode === "create"}
          />
        </Field>
        <Field label="Category" htmlFor={f("category")}>
          <select id={f("category")} name="categoryId" defaultValue={values.categoryId ?? ""} className="input">
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Unit of measure" htmlFor={f("uom")}>
          <input
            id={f("uom")}
            name="uom"
            list="uom-options"
            required
            maxLength={20}
            defaultValue={values.uom ?? "pcs"}
            className="input"
          />
          <datalist id="uom-options">
            {UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Field>
        <Field label="SKU / internal reference" htmlFor={f("sku")} hint="Optional. Must be unique.">
          <input id={f("sku")} name="sku" maxLength={64} defaultValue={values.sku ?? ""} className="input font-mono" autoCapitalize="characters" />
        </Field>
        <Field label="Barcode" htmlFor={f("barcode")} hint="EAN, UPC or any code you scan.">
          <input id={f("barcode")} name="barcode" maxLength={64} defaultValue={values.barcode ?? ""} className="input font-mono" inputMode="numeric" />
        </Field>
        <Field label="Cost price" htmlFor={f("cost")}>
          <input id={f("cost")} name="cost" type="number" min={0} step="0.01" inputMode="decimal" defaultValue={centsToInput(values.costCents)} className="input" />
        </Field>
        <Field label="Sale price" htmlFor={f("sale")}>
          <input id={f("sale")} name="salePrice" type="number" min={0} step="0.01" inputMode="decimal" defaultValue={centsToInput(values.salePriceCents)} className="input" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description" htmlFor={f("desc")}>
            <textarea id={f("desc")} name="description" rows={3} maxLength={2000} defaultValue={values.description ?? ""} className="input" />
          </Field>
        </div>
      </section>

      {mode === "create" && locations ? (
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="section-title">Opening stock</h2>
            <p className="hint mt-1">How many do you have right now, and where are they kept? You can leave this at 0.</p>
          </div>
          <Field label="Quantity" htmlFor={f("qty")}>
            <input id={f("qty")} name="initialQuantity" type="number" min={0} step="any" inputMode="decimal" defaultValue={0} className="input" />
          </Field>
          <Field label="Location / section" htmlFor={f("loc")}>
            <select id={f("loc")} name="initialLocationId" defaultValue={defaultLocationId} className="input">
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
        </section>
      ) : null}

      <div className="flex flex-col gap-3">
        <FormMessage state={state} />
        <div>
          <SubmitButton pendingText="Saving…">{mode === "create" ? "Create product" : "Save changes"}</SubmitButton>
        </div>
      </div>
    </form>
  );
}
