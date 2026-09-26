import { ArrowDownLeft, ArrowUpRight, RefreshCcw, Shuffle } from "lucide-react";
import Link from "next/link";
import { formatDateTime, formatQty, OPERATION_LABELS } from "@/lib/format";
import type { listMoves } from "@/server/reports";

type Move = Awaited<ReturnType<typeof listMoves>>[number];

export function MoveList({ moves, showProduct = true }: { moves: Move[]; showProduct?: boolean }) {
  if (moves.length === 0) return <p className="px-4 py-8 text-center text-sm text-muted">No stock movements yet.</p>;
  return (
    <ul>
      {moves.map((m) => {
        const inbound = m.destType === "internal" && m.sourceType !== "internal";
        const outbound = m.sourceType === "internal" && m.destType !== "internal";
        const Icon = inbound ? ArrowDownLeft : outbound ? ArrowUpRight : m.operationType === "adjustment" ? RefreshCcw : Shuffle;
        return (
          <li key={m.id} className="flex gap-3 border-b border-border px-4 py-3 last:border-0">
            <span
              className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${
                inbound ? "bg-success-soft text-success" : outbound ? "bg-danger-soft text-danger" : "bg-surface-2 text-muted"
              }`}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-sm font-medium">
                  {showProduct ? (
                    <Link href={`/products/${m.productId}`} className="hover:text-accent">
                      {m.productName}
                    </Link>
                  ) : (
                    OPERATION_LABELS[m.operationType]
                  )}
                </p>
                <span className={`shrink-0 text-sm font-semibold tabular-nums ${inbound ? "text-success" : outbound ? "text-danger" : ""}`}>
                  {inbound ? "+" : outbound ? "−" : ""}
                  {formatQty(m.quantity)} {m.uom}
                </span>
              </div>
              <p className="mt-0.5 text-xs break-words text-muted">
                {m.sourceName} → {m.destName}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                <Link href={`/operations/${m.operationId}`} className="font-mono hover:text-accent hover:underline">
                  {m.reference}
                </Link>
                {" · "}
                {m.userName ?? "Someone"} · {formatDateTime(m.doneAt)}
                {m.note ? ` · ${m.note}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
