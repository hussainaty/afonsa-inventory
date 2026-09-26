import { ArrowDownLeft, ArrowUpRight, Boxes, Plus, RefreshCcw, Shuffle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, StatCard } from "@/components/layout-bits";
import { db } from "@/db";
import { formatMoney, formatQty, formatRelative, OPERATION_LABELS } from "@/lib/format";
import { requirePageContext } from "@/server/context";
import { dashboardStats, listMoves, replenishmentReport } from "@/server/reports";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await requirePageContext();
  const [stats, moves, replenish] = await Promise.all([
    dashboardStats(db, ctx.org.id),
    listMoves(db, ctx.org.id, { limit: 8 }),
    replenishmentReport(db, ctx.org.id),
  ]);

  return (
    <>
      <PageHeader
        title={ctx.org.name}
        description={`Welcome back, ${ctx.user.name.split(" ")[0]}.`}
        actions={
          <>
            <Link href="/operations/new?type=receipt" className="btn-secondary">
              <ArrowDownLeft className="size-4" aria-hidden /> Receive
            </Link>
            <Link href="/products/new" className="btn-primary">
              <Plus className="size-4" aria-hidden /> Add product
            </Link>
          </>
        }
      />

      {stats.productCount === 0 ? (
        <EmptyState
          icon={<Boxes className="size-6" aria-hidden />}
          title="Add your first product"
          description="Products are the things you stock. Give each one a category, and record where it's kept and how many you have."
          action={
            <Link href="/products/new" className="btn-primary">
              <Plus className="size-4" aria-hidden /> Add product
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Products" value={formatQty(stats.productCount)} hint={`${stats.categoryCount} ${stats.categoryCount === 1 ? "category" : "categories"}`} />
            <StatCard label="Units on hand" value={formatQty(stats.totalUnits)} hint={`in ${stats.locationCount} location${stats.locationCount === 1 ? "" : "s"}`} />
            <StatCard label="Stock value (cost)" value={formatMoney(stats.stockValueCents)} />
            <StatCard
              label="Need reordering"
              value={stats.lowStockCount}
              tone={stats.lowStockCount > 0 ? "warning" : undefined}
              hint={stats.draftOperations > 0 ? `${stats.draftOperations} draft operations` : "All caught up"}
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="section-title">Needs reordering</h2>
                <Link href="/replenishment" className="text-sm font-medium text-accent hover:underline">
                  View all
                </Link>
              </div>
              {replenish.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">
                  Nothing is below its minimum. Set min/max levels on a product to get alerts here.
                </p>
              ) : (
                <ul>
                  {replenish.slice(0, 6).map((r) => (
                    <li key={r.ruleId} className="border-b border-border last:border-0">
                      <Link href={`/products/${r.productId}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{r.productName}</span>
                          <span className="block truncate text-xs text-muted">{r.locationName}</span>
                        </span>
                        <span className="shrink-0 text-right text-sm tabular-nums">
                          <span className="font-semibold text-warning">{formatQty(r.onHand)}</span>
                          <span className="text-muted"> / min {formatQty(r.minQuantity)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="section-title">Recent movements</h2>
                <Link href="/history" className="text-sm font-medium text-accent hover:underline">
                  Full history
                </Link>
              </div>
              {moves.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">No stock movements yet.</p>
              ) : (
                <ul>
                  {moves.map((m) => {
                    const inbound = m.destType === "internal" && m.sourceType !== "internal";
                    const outbound = m.sourceType === "internal" && m.destType !== "internal";
                    const Icon = inbound ? ArrowDownLeft : outbound ? ArrowUpRight : m.operationType === "adjustment" ? RefreshCcw : Shuffle;
                    return (
                      <li key={m.id} className="border-b border-border last:border-0">
                        <Link href={`/products/${m.productId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                          <span
                            className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                              inbound ? "bg-success-soft text-success" : outbound ? "bg-danger-soft text-danger" : "bg-surface-2 text-muted"
                            }`}
                          >
                            <Icon className="size-4" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{m.productName}</span>
                            <span className="block truncate text-xs text-muted">
                              {OPERATION_LABELS[m.operationType]} · {m.userName ?? "Someone"} · {formatRelative(m.doneAt!)}
                            </span>
                          </span>
                          <span className={`shrink-0 text-sm font-semibold tabular-nums ${inbound ? "text-success" : outbound ? "text-danger" : ""}`}>
                            {inbound ? "+" : outbound ? "−" : ""}
                            {formatQty(m.quantity)} {m.uom}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
