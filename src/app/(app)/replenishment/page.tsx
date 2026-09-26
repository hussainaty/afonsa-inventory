import { ArrowDownLeft, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/layout-bits";
import { db } from "@/db";
import { formatQty, itemName } from "@/lib/format";
import { requirePageContext } from "@/server/context";
import { replenishmentReport } from "@/server/reports";

export const metadata: Metadata = { title: "Replenishment" };

export default async function ReplenishmentPage() {
  const ctx = await requirePageContext();
  const rows = await replenishmentReport(db, ctx.org.id);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Replenishment"
        description="Products at or below their minimum, based on each product's reordering rules."
        actions={
          rows.length > 0 ? (
            <Link href="/operations/new?type=receipt" className="btn-primary">
              <ArrowDownLeft className="size-4" aria-hidden /> Receive stock
            </Link>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="size-6" aria-hidden />}
          title="Nothing to reorder"
          description="Everything is above its minimum. Add min/max reordering rules on a product page to track it here."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Location</th>
                <th scope="col" className="text-right">On hand</th>
                <th scope="col" className="text-right">Min / Max</th>
                <th scope="col" className="text-right">To order</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ruleId}>
                  <td>
                    <Link href={`/products/${r.productId}`} className="font-medium hover:text-accent">
                      {itemName(r.productName, r.productVariant)}
                    </Link>
                    {r.sku ? <span className="block font-mono text-xs text-muted">{r.sku}</span> : null}
                  </td>
                  <td className="text-muted">{r.locationName}</td>
                  <td className="text-right font-semibold text-warning tabular-nums">{formatQty(r.onHand)}</td>
                  <td className="text-right text-muted tabular-nums">
                    {formatQty(r.minQuantity)} / {formatQty(r.maxQuantity)}
                  </td>
                  <td className="text-right font-semibold tabular-nums">
                    {formatQty(r.toOrder)} {r.uom}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
