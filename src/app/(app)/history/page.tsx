import type { Metadata } from "next";
import { PageHeader } from "@/components/layout-bits";
import { MoveList } from "@/components/move-list";
import { db } from "@/db";
import { requirePageContext } from "@/server/context";
import { listMoves } from "@/server/reports";

export const metadata: Metadata = { title: "Stock history" };

export default async function HistoryPage() {
  const ctx = await requirePageContext();
  const moves = await listMoves(db, ctx.org.id, { limit: 200 });
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Stock history"
        description="Every validated movement, newest first. Moves are never edited or deleted, so this is a complete audit trail."
      />
      <section className="card overflow-hidden">
        <MoveList moves={moves} />
      </section>
    </div>
  );
}
