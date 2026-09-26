"use client";

import { ClipboardCheck, MapPin, Minus, Plus, Shuffle, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  addStockNewSizeAction,
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
type Size = { id: string; variant: string | null };
type Row = { productId: string; locationId: string; fullName: string; quantity: number };

const NEW_SIZE = "__new__";

const MODES: { mode: Mode; label: string; icon: typeof Plus }[] = [
  { mode: "add", label: "Add", icon: Plus },
  { mode: "subtract", label: "Subtract", icon: Minus },
  { mode: "move", label: "Move", icon: Shuffle },
  { mode: "count", label: "Count", icon: ClipboardCheck },
];

const sizeLabel = (s: Size) => s.variant ?? "Standard";

function StockForm({
  mode,
  familyId,
  uom,
  sizes,
  locations,
  stock,
  initialProductId,
  initialLocationId,
  onDone,
}: {
  mode: Mode;
  familyId: string;
  uom: string;
  sizes: Size[];
  locations: Loc[];
  stock: Row[];
  initialProductId: string;
  initialLocationId: string;
  onDone: () => void;
}) {
  const [productId, setProductId] = useState(initialProductId);
  const isNewSize = mode === "add" && productId === NEW_SIZE;
  const action = isNewSize
    ? addStockNewSizeAction
    : mode === "move"
      ? transferStockAction
      : mode === "count"
        ? countStockAction
        : adjustStockAction;
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const [loc, setLoc] = useState(initialLocationId);

  const rowsForSize = stock.filter((s) => s.productId === productId);
  const qtyAt = (id: string) => rowsForSize.find((s) => s.locationId === id)?.quantity ?? 0;
  const stockedHere = rowsForSize.filter((s) => s.quantity > 0);
  const multipleSizes = sizes.length > 1 || sizes.some((s) => s.variant);

  useEffect(() => {
    if (state.ok) {
      const t = setTimeout(onDone, 900);
      return () => clearTimeout(t);
    }
  }, [state, onDone]);

  const id = (n: string) => `stock-${mode}-${n}`;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {isNewSize ? <input type="hidden" name="familyId" value={familyId} /> : <input type="hidden" name="productId" value={productId} />}
      {(mode === "add" || mode === "subtract") && !isNewSize ? <input type="hidden" name="direction" value={mode} /> : null}

      {multipleSizes || mode === "add" ? (
        <div className="field">
          <label htmlFor={id("size")} className="label">Size</label>
          <select
            id={id("size")}
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              const first = stock.find((s) => s.productId === e.target.value && s.quantity > 0);
              if (first && mode !== "add") setLoc(first.locationId);
            }}
            className="input"
          >
            {sizes.map((s) => (
              <option key={s.id} value={s.id}>
                {sizeLabel(s)}
              </option>
            ))}
            {mode === "add" ? <option value={NEW_SIZE}>+ New size…</option> : null}
          </select>
        </div>
      ) : null}

      {isNewSize ? (
        <div className="field">
          <label htmlFor={id("variant")} className="label">New size</label>
          <input id={id("variant")} name="variant" required maxLength={60} placeholder="e.g. 20 inch" className="input" autoFocus />
          <p className="hint">Creates the size under this item and adds the stock in one step.</p>
        </div>
      ) : null}

      {mode === "move" ? (
        <>
          <div className="field">
            <label htmlFor={id("from")} className="label">From</label>
            <select id={id("from")} name="fromLocationId" value={loc} onChange={(e) => setLoc(e.target.value)} className="input">
              {(stockedHere.length ? stockedHere : rowsForSize).map((s) => (
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
                {isNewSize ? l.fullName : `${l.fullName} · ${formatQty(qtyAt(l.id))} ${uom}`}
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
          autoFocus={!isNewSize}
          defaultValue={mode === "count" ? qtyAt(loc) : undefined}
          key={`${productId}-${loc}`}
          className="input text-lg tabular-nums"
        />
        {mode === "subtract" ? (
          <p className="hint">
            Available here: {formatQty(qtyAt(loc))} {uom}
          </p>
        ) : mode === "count" ? (
          <p className="hint">
            System quantity: {formatQty(qtyAt(loc))} {uom}. The difference is recorded as an adjustment.
          </p>
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
            <label htmlFor={id("partner")} className="label">
              {mode === "add" ? "Supplier" : "Customer"} (optional)
            </label>
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
        {mode === "add"
          ? "Add to stock"
          : mode === "subtract"
            ? "Subtract from stock"
            : mode === "move"
              ? "Move stock"
              : "Save count"}
      </SubmitButton>
    </form>
  );
}

export function StockPanel({
  familyId,
  currentProductId,
  itemName,
  uom,
  sizes,
  stock,
  locations,
}: {
  familyId: string;
  currentProductId: string;
  itemName: string;
  uom: string;
  sizes: Size[];
  stock: Row[];
  locations: Loc[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [target, setTarget] = useState({
    productId: currentProductId,
    locationId: stock.find((s) => s.productId === currentProductId)?.locationId ?? locations[0]?.id ?? "",
  });
  const [formKey, setFormKey] = useState(0);
  const total = stock.reduce((s, r) => s + r.quantity, 0);
  const hasSizes = sizes.length > 1 || sizes.some((s) => s.variant);

  function openWith(m: Mode, productId = currentProductId, locationId?: string) {
    setMode(m);
    setTarget({
      productId,
      locationId:
        locationId ?? stock.find((s) => s.productId === productId && s.quantity > 0)?.locationId ?? locations[0]?.id ?? "",
    });
    setFormKey((k) => k + 1);
    dialogRef.current?.showModal();
  }
  const close = () => dialogRef.current?.close();

  const groups = sizes
    .map((size) => ({ size, rows: stock.filter((r) => r.productId === size.id) }))
    .filter((g) => g.rows.length > 0 || g.size.id === currentProductId);

  return (
    <section className="card overflow-hidden" aria-labelledby="stock-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 id="stock-heading" className="section-title">
            {hasSizes ? "Stock by size & location" : "Stock by location"}
          </h2>
          <p className="text-sm text-muted">
            Total on hand:{" "}
            <span className="font-semibold text-text tabular-nums">
              {formatQty(total)} {uom}
            </span>
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

      {stock.length === 0 && !hasSizes ? (
        <div className="px-4 py-8 text-center">
          <MapPin className="mx-auto mb-2 size-6 text-muted" aria-hidden />
          <p className="text-sm text-muted">No stock yet. Use “Add” to record where this item is kept.</p>
        </div>
      ) : (
        <div>
          {groups.map(({ size, rows }) => {
            const sizeTotal = rows.reduce((s, r) => s + r.quantity, 0);
            return (
              <div key={size.id} className="border-b border-border last:border-0" data-size={sizeLabel(size)}>
                {hasSizes ? (
                  <div className="flex items-center justify-between gap-2 bg-surface-2/60 px-4 py-2">
                    <span className="text-sm font-semibold">
                      {sizeLabel(size)}
                      {size.id === currentProductId ? <span className="font-normal text-muted"> · this size</span> : null}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatQty(sizeTotal)} {uom}
                    </span>
                  </div>
                ) : null}
                {rows.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted">No stock of this size.</p>
                ) : (
                  <ul>
                    {rows.map((s) => (
                      <li key={s.locationId} className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0">
                        <MapPin className="size-4 shrink-0 text-muted" aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-sm">{s.fullName}</span>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatQty(s.quantity)} {uom}
                        </span>
                        <span className="flex gap-1">
                          <button
                            type="button"
                            className="btn-secondary btn-sm size-9 px-0"
                            aria-label={`Subtract ${sizeLabel(size)} from ${s.fullName}`}
                            onClick={() => openWith("subtract", size.id, s.locationId)}
                          >
                            <Minus className="size-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="btn-secondary btn-sm size-9 px-0"
                            aria-label={`Add ${sizeLabel(size)} to ${s.fullName}`}
                            onClick={() => openWith("add", size.id, s.locationId)}
                          >
                            <Plus className="size-4" aria-hidden />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
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
                <p className="truncate text-sm text-muted">{itemName}</p>
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
                familyId={familyId}
                uom={uom}
                sizes={sizes}
                locations={locations}
                stock={stock}
                initialProductId={target.productId}
                initialLocationId={target.locationId}
                onDone={close}
              />
            </div>
          </div>
        ) : null}
      </dialog>
    </section>
  );
}
