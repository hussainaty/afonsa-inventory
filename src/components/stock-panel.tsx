"use client";

import { ClipboardCheck, MapPin, Minus, Plus, Shuffle, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  adjustStockAction,
  countStockAction,
  transferStockAction,
  type ActionState,
} from "@/app/actions";
import { formatQty } from "@/lib/format";
import { ADD_REASONS, REASON_LABELS, SUBTRACT_REASONS } from "@/lib/validation";
import { FormMessage, SubmitButton } from "./ui";

type Mode = "add" | "subtract" | "move" | "count";
type Loc = { id: string; fullName: string };
type Row = { locationId: string; fullName: string; quantity: number };

const MODES: { mode: Mode; label: string; icon: typeof Plus }[] = [
  { mode: "add", label: "Add", icon: Plus },
  { mode: "subtract", label: "Subtract", icon: Minus },
  { mode: "move", label: "Move", icon: Shuffle },
  { mode: "count", label: "Count", icon: ClipboardCheck },
];

function StockForm({
  mode,
  productId,
  uom,
  locations,
  stock,
  locationId,
  onDone,
}: {
  mode: Mode;
  productId: string;
  uom: string;
  locations: Loc[];
  stock: Row[];
  locationId: string;
  onDone: () => void;
}) {
  const action = mode === "move" ? transferStockAction : mode === "count" ? countStockAction : adjustStockAction;
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const [loc, setLoc] = useState(locationId);
  const qtyAt = (id: string) => stock.find((s) => s.locationId === id)?.quantity ?? 0;
  const stocked = stock.filter((s) => s.quantity > 0);

  useEffect(() => {
    if (state.ok) {
      const t = setTimeout(onDone, 900);
      return () => clearTimeout(t);
    }
  }, [state, onDone]);

  const id = (n: string) => `stock-${mode}-${n}`;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="productId" value={productId} />
      {mode === "add" || mode === "subtract" ? <input type="hidden" name="direction" value={mode} /> : null}

      {mode === "move" ? (
        <>
          <div className="field">
            <label htmlFor={id("from")} className="label">From</label>
            <select
              id={id("from")}
              name="fromLocationId"
              value={loc}
              onChange={(e) => setLoc(e.target.value)}
              className="input"
            >
              {(stocked.length ? stocked : stock).map((s) => (
                <option key={s.locationId} value={s.locationId}>
                  {s.fullName} ({formatQty(s.quantity)} {uom})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={id("to")} className="label">To</label>
            <select id={id("to")} name="toLocationId" className="input" defaultValue={locations.find((l) => l.id !== loc)?.id}>
              {locations
                .filter((l) => l.id !== loc)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.fullName}
                  </option>
                ))}
            </select>
          </div>
        </>
      ) : (
        <div className="field">
          <label htmlFor={id("loc")} className="label">Location / section</label>
          <select id={id("loc")} name="locationId" value={loc} onChange={(e) => setLoc(e.target.value)} className="input">
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.fullName} · {formatQty(qtyAt(l.id))} {uom}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="field">
        <label htmlFor={id("amount")} className="label">
          {mode === "count" ? `Counted quantity (${uom})` : `Amount (${uom})`}
        </label>
        <input
          id={id("amount")}
          name={mode === "count" ? "countedQuantity" : "amount"}
          type="number"
          inputMode="decimal"
          min={mode === "count" ? 0 : 0.0001}
          step="any"
          required
          autoFocus
          defaultValue={mode === "count" ? qtyAt(loc) : undefined}
          className="input text-lg tabular-nums"
        />
        {mode === "subtract" ? (
          <p className="hint">Available here: {formatQty(qtyAt(loc))} {uom}</p>
        ) : mode === "count" ? (
          <p className="hint">System quantity: {formatQty(qtyAt(loc))} {uom}. The difference is recorded as an adjustment.</p>
        ) : null}
      </div>

      {mode === "add" || mode === "subtract" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label htmlFor={id("reason")} className="label">Reason</label>
            <select id={id("reason")} name="reason" className="input">
              {(mode === "add" ? ADD_REASONS : SUBTRACT_REASONS).map((r) => (
                <option key={r} value={r}>
                  {REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={id("partner")} className="label">{mode === "add" ? "Supplier" : "Customer"} (optional)</label>
            <input id={id("partner")} name="partner" maxLength={120} className="input" />
          </div>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor={id("note")} className="label">Note (optional)</label>
        <input id={id("note")} name="note" maxLength={500} className="input" />
      </div>

      <FormMessage state={state} />
      <SubmitButton className={mode === "subtract" ? "btn-danger" : "btn-primary"} pendingText="Saving…">
        {mode === "add" ? "Add to stock" : mode === "subtract" ? "Subtract from stock" : mode === "move" ? "Move stock" : "Save count"}
      </SubmitButton>
    </form>
  );
}

export function StockPanel({
  productId,
  productName,
  uom,
  stock,
  locations,
}: {
  productId: string;
  productName: string;
  uom: string;
  stock: Row[];
  locations: Loc[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [locationId, setLocationId] = useState(stock[0]?.locationId ?? locations[0]?.id ?? "");
  const [formKey, setFormKey] = useState(0);
  const total = stock.reduce((s, r) => s + r.quantity, 0);

  function openWith(m: Mode, loc?: string) {
    setMode(m);
    if (loc) setLocationId(loc);
    setFormKey((k) => k + 1);
    dialogRef.current?.showModal();
  }
  const close = () => dialogRef.current?.close();

  return (
    <section className="card overflow-hidden" aria-labelledby="stock-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 id="stock-heading" className="section-title">Stock by location</h2>
          <p className="text-sm text-muted">
            Total on hand: <span className="font-semibold text-text tabular-nums">{formatQty(total)} {uom}</span>
          </p>
        </div>
        <div className="grid w-full grid-cols-4 gap-2 sm:w-auto">
          {MODES.map(({ mode: m, label, icon: Icon }) => (
            <button
              key={m}
              type="button"
              onClick={() => openWith(m)}
              disabled={(m === "subtract" || m === "move") && total <= 0}
              className={`btn-sm ${m === "add" ? "btn-primary" : "btn-secondary"} btn flex-col gap-0.5 py-1.5 sm:flex-row sm:gap-1.5`}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      {stock.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <MapPin className="mx-auto mb-2 size-6 text-muted" aria-hidden />
          <p className="text-sm text-muted">No stock yet. Use “Add” to record where this product is kept.</p>
        </div>
      ) : (
        <ul>
          {stock.map((s) => (
            <li key={s.locationId} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
              <MapPin className="size-4 shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm">{s.fullName}</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatQty(s.quantity)} {uom}
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  className="btn-secondary btn-sm size-9 px-0"
                  aria-label={`Subtract from ${s.fullName}`}
                  onClick={() => openWith("subtract", s.locationId)}
                >
                  <Minus className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm size-9 px-0"
                  aria-label={`Add to ${s.fullName}`}
                  onClick={() => openWith("add", s.locationId)}
                >
                  <Plus className="size-4" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialogRef}
        // The close event is async: ignore a stale one that lands after the dialog was reopened.
        onClose={() => {
          if (!dialogRef.current?.open) setMode(null);
        }}
        aria-labelledby="stock-dialog-title"
        className="m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-3xl border border-border bg-surface p-0 text-text sm:m-auto sm:w-[min(92vw,30rem)] sm:rounded-3xl"
      >
        {mode ? (
          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <h2 id="stock-dialog-title" className="section-title capitalize">
                  {mode === "count" ? "Physical count" : mode}
                </h2>
                <p className="truncate text-sm text-muted">{productName}</p>
              </div>
              <button type="button" className="btn-ghost btn-sm" onClick={close} aria-label="Close">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="px-5 pt-4" role="tablist" aria-label="Stock action">
              <div className="grid grid-cols-4 gap-1 rounded-xl bg-surface-2 p-1">
                {MODES.map(({ mode: m, label }) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => {
                      setMode(m);
                      setFormKey((k) => k + 1);
                    }}
                    className={`min-h-9 rounded-lg text-xs font-semibold ${mode === m ? "bg-surface text-text shadow-sm" : "text-muted"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              <StockForm
                key={formKey}
                mode={mode}
                productId={productId}
                uom={uom}
                locations={locations}
                stock={stock}
                locationId={locationId}
                onDone={close}
              />
            </div>
          </div>
        ) : null}
      </dialog>
    </section>
  );
}
