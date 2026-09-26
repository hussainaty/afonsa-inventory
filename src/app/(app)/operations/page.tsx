import { ArrowLeftRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, StateBadge } from "@/components/layout-bits";
import { db } from "@/db";
import { formatDateTime, OPERATION_LABELS } from "@/lib/format";
import { requirePageContext } from "@/server/context";
import { listOperations } from "@/server/reports";

export const metadata: Metadata = { title: "Operations" };

const TABS = [
  { value: "", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
] as const;


export default async function OperationsPage({ searchParams }: PageProps<"/operations">) {
  const ctx = await requirePageContext();
  const sp = await searchParams;
  const state = (["draft", "done", "cancelled"] as const).find((s) => s === sp.state);
  const ops = await listOperations(db, ctx.org.id, { state });

  return (
    <>
      <PageHeader
        title="Operations"
        description="Receipts, deliveries, transfers and adjustments. Every stock change is recorded here."
        actions={
          <Link href="/operations/new" className="btn-primary">
            <Plus className="size-4" aria-hidden /> New operation
          </Link>
        }
      />

      <nav aria-label="Filter by state" className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1">
        {TABS.map((t) => {
          const active = (state ?? "") === t.value;
          return (
            <Link
              key={t.value}
              href={t.value ? `/operations?state=${t.value}` : "/operations"}
              aria-current={active ? "page" : undefined}
              className={`min-h-9 flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium whitespace-nowrap ${
                active ? "bg-surface text-text shadow-sm" : "text-muted"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {ops.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight className="size-6" aria-hidden />}
          title="No operations"
          description="Receive goods, ship them out or move them between locations. Quick add/subtract on a product also creates operations."
          action={
            <Link href="/operations/new" className="btn-primary">
              <Plus className="size-4" aria-hidden /> New operation
            </Link>
          }
        />
      ) : (
        <ul className="card overflow-hidden">
          {ops.map((o) => (
            <li key={o.id} className="border-b border-border last:border-0">
              <Link href={`/operations/${o.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="font-mono">{o.reference}</span>
                    <span className="text-muted">{OPERATION_LABELS[o.type]}</span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {o.sourceName} → {o.destName}
                    {o.partner ? ` · ${o.partner}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {o.lineCount} line{o.lineCount === 1 ? "" : "s"} · {formatDateTime(o.validatedAt ?? o.createdAt)}
                  </p>
                </div>
                <StateBadge state={o.state} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
