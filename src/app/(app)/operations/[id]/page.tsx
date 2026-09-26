import { Check, ChevronLeft, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelOperationAction, validateOperationAction } from "@/app/actions";
import { ActionButton } from "@/components/forms/action-button";
import { PageHeader, StateBadge } from "@/components/layout-bits";
import { db } from "@/db";
import { formatDateTime, formatQty, itemName, OPERATION_LABELS } from "@/lib/format";
import { requirePageContext } from "@/server/context";
import { getOperation } from "@/server/reports";

export const metadata: Metadata = { title: "Operation" };

export default async function OperationPage({ params }: PageProps<"/operations/[id]">) {
  const ctx = await requirePageContext();
  const { id } = await params;
  const data = await getOperation(db, ctx.org.id, id);
  if (!data) notFound();
  const op = data.operation;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={
          <Link href="/operations" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-text">
            <ChevronLeft className="size-4" aria-hidden /> Operations
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{op.reference}</span>
            <StateBadge state={op.state} />
          </span>
        }
        description={OPERATION_LABELS[op.type]}
        actions={
          op.state === "draft" ? (
            <>
              <ActionButton action={cancelOperationAction} fields={{ id: op.id }} className="btn-secondary" confirm="Cancel this operation?">
                <X className="size-4" aria-hidden /> Cancel
              </ActionButton>
              <ActionButton action={validateOperationAction} fields={{ id: op.id }} className="btn-primary" pendingText="Validating…">
                <Check className="size-4" aria-hidden /> Validate
              </ActionButton>
            </>
          ) : null
        }
      />

      <div className="flex flex-col gap-6">
        <dl className="card grid gap-4 p-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">From</dt>
            <dd className="font-medium break-words">{data.sourceName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">To</dt>
            <dd className="font-medium break-words">{data.destName}</dd>
          </div>
          {op.partner ? (
            <div>
              <dt className="text-xs text-muted">Partner</dt>
              <dd className="font-medium">{op.partner}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-muted">Created</dt>
            <dd>
              {formatDateTime(op.createdAt)} by {data.createdByName ?? "—"}
            </dd>
          </div>
          {op.validatedAt ? (
            <div>
              <dt className="text-xs text-muted">Validated</dt>
              <dd>
                {formatDateTime(op.validatedAt)} by {data.validatedByName ?? "—"}
              </dd>
            </div>
          ) : null}
          {op.note ? (
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted">Note</dt>
              <dd className="break-words">{op.note}</dd>
            </div>
          ) : null}
        </dl>

        <section className="card overflow-hidden" aria-labelledby="op-lines">
          <h2 id="op-lines" className="section-title border-b border-border px-4 py-3">Products</h2>
          <ul>
            {data.lines.map((l) => (
              <li key={l.id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
                <Link href={`/products/${l.productId}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-accent">
                  {itemName(l.productName, l.productVariant)}
                  {l.sku ? <span className="ml-2 font-mono text-xs text-muted">{l.sku}</span> : null}
                </Link>
                <span className="text-sm font-semibold tabular-nums">
                  {formatQty(l.quantity)} {l.uom}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
