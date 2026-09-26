"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { createOperationAction, type ActionState } from "@/app/actions";
import { FormMessage, SubmitButton } from "../ui";

type OpType = "receipt" | "delivery" | "internal";
type Line = { key: number; productId: string; quantity: string };

const TYPES: { value: OpType; label: string; hint: string }[] = [
  { value: "receipt", label: "Receipt", hint: "Goods arriving from a supplier" },
  { value: "delivery", label: "Delivery", hint: "Goods leaving to a customer" },
  { value: "internal", label: "Internal transfer", hint: "Move between your locations" },
];

export function OperationForm({
  products,
  locations,
  defaultType = "receipt",
}: {
  products: { id: string; label: string; uom: string }[];
  locations: { id: string; fullName: string }[];
  defaultType?: OpType;
}) {
  const [state, action] = useActionState<ActionState, FormData>(createOperationAction, {});
  const [type, setType] = useState<OpType>(defaultType);
  const [lines, setLines] = useState<Line[]>([{ key: 0, productId: products[0]?.id ?? "", quantity: "" }]);
  const [nextKey, setNextKey] = useState(1);

  const update = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const payload = JSON.stringify(
    lines.filter((l) => l.productId && l.quantity).map((l) => ({ productId: l.productId, quantity: Number(l.quantity) })),
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="lines" value={payload} />

      <fieldset className="card p-5">
        <legend className="sr-only">Operation type</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {TYPES.map((t) => (
            <label
              key={t.value}
              className={`flex cursor-pointer flex-col rounded-xl border p-3 ${
                type === t.value ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={t.value}
                checked={type === t.value}
                onChange={() => setType(t.value)}
                className="sr-only"
              />
              <span className="text-sm font-semibold">{t.label}</span>
              <span className="text-xs text-muted">{t.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        {type !== "receipt" ? (
          <div className="field">
            <label htmlFor="op-src" className="label">From location</label>
            <select id="op-src" name="sourceLocationId" className="input" defaultValue={locations[0]?.id}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.fullName}</option>
              ))}
            </select>
          </div>
        ) : null}
        {type !== "delivery" ? (
          <div className="field">
            <label htmlFor="op-dst" className="label">To location</label>
            <select id="op-dst" name="destLocationId" className="input" defaultValue={locations[type === "internal" ? 1 : 0]?.id ?? locations[0]?.id}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.fullName}</option>
              ))}
            </select>
          </div>
        ) : null}
        {type !== "internal" ? (
          <div className="field">
            <label htmlFor="op-partner" className="label">{type === "receipt" ? "Supplier" : "Customer"} (optional)</label>
            <input id="op-partner" name="partner" maxLength={120} className="input" />
          </div>
        ) : null}
        <div className="field sm:col-span-2">
          <label htmlFor="op-note" className="label">Note (optional)</label>
          <input id="op-note" name="note" maxLength={500} className="input" />
        </div>
      </section>

      <section className="card p-5" aria-labelledby="lines-heading">
        <h2 id="lines-heading" className="section-title mb-4">Products</h2>
        <ul className="flex flex-col gap-3">
          {lines.map((l, i) => {
            const uom = products.find((p) => p.id === l.productId)?.uom ?? "";
            return (
              <li key={l.key} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
                <div className="field">
                  <label htmlFor={`line-p-${l.key}`} className={i === 0 ? "label" : "sr-only"}>Product</label>
                  <select
                    id={`line-p-${l.key}`}
                    value={l.productId}
                    onChange={(e) => update(l.key, { productId: e.target.value })}
                    className="input"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`line-q-${l.key}`} className={i === 0 ? "label" : "sr-only"}>Qty {uom ? `(${uom})` : ""}</label>
                  <input
                    id={`line-q-${l.key}`}
                    type="number"
                    min={0.0001}
                    step="any"
                    inputMode="decimal"
                    required
                    value={l.quantity}
                    onChange={(e) => update(l.key, { quantity: e.target.value })}
                    className="input tabular-nums"
                  />
                </div>
                <button
                  type="button"
                  className="btn-ghost size-11 px-0"
                  aria-label="Remove line"
                  disabled={lines.length === 1}
                  onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className="btn-secondary btn-sm mt-4"
          onClick={() => {
            setLines((ls) => [...ls, { key: nextKey, productId: products[0]?.id ?? "", quantity: "" }]);
            setNextKey((k) => k + 1);
          }}
        >
          <Plus className="size-4" aria-hidden /> Add line
        </button>
      </section>

      <div className="flex flex-col gap-3">
        <FormMessage state={state} />
        <div className="flex flex-wrap gap-2">
          <SubmitButton name="validateNow" value="true" pendingText="Saving…">Save & validate</SubmitButton>
          <SubmitButton name="validateNow" value="false" className="btn-secondary">Save as draft</SubmitButton>
        </div>
        <p className="hint">Drafts don’t change stock until someone validates them.</p>
      </div>
    </form>
  );
}
