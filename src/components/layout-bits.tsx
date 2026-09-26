import { STATE_LABELS } from "@/lib/format";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="page-title">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">{icon}</div>
      <h2 className="section-title">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "warning" }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "warning" ? "text-warning" : ""}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function CategoryBadge({ name, color }: { name: string | null; color: string | null }) {
  if (!name) return <span className="badge bg-surface-2 text-muted">Uncategorized</span>;
  return (
    <span className="badge bg-surface-2 text-text">
      <span className="size-2 rounded-full" style={{ background: color ?? "#64748b" }} aria-hidden />
      {name}
    </span>
  );
}

export function StockBadge({ onHand, min, uom }: { onHand: number; min: number; uom: string }) {
  const q = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(onHand);
  if (onHand <= 0) return <span className="badge bg-danger-soft text-danger tabular-nums">Out · {q} {uom}</span>;
  if (min > 0 && onHand <= min)
    return <span className="badge bg-warning-soft text-warning tabular-nums">Low · {q} {uom}</span>;
  return <span className="badge bg-success-soft text-success tabular-nums">{q} {uom}</span>;
}

export function StateBadge({ state }: { state: "draft" | "done" | "cancelled" }) {
  const cls =
    state === "done" ? "bg-success-soft text-success" : state === "draft" ? "bg-warning-soft text-warning" : "bg-surface-2 text-muted";
  return <span className={`badge ${cls}`}>{STATE_LABELS[state]}</span>;
}
