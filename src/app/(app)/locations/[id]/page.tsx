import { Archive, ChevronLeft, Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveLocationAction } from "@/app/actions";
import { ActionButton } from "@/components/forms/action-button";
import { NewLocationForm, RenameLocationForm } from "@/components/forms/location-forms";
import { EmptyState, PageHeader } from "@/components/layout-bits";
import { MoveList } from "@/components/move-list";
import { db } from "@/db";
import { formatQty } from "@/lib/format";
import { canManage, requirePageContext } from "@/server/context";
import { listMoves, locationContents } from "@/server/reports";

export const metadata: Metadata = { title: "Location" };

export default async function LocationPage({ params }: PageProps<"/locations/[id]">) {
  const ctx = await requirePageContext();
  const { id } = await params;
  const data = await locationContents(db, ctx.org.id, id);
  if (!data || data.location.type !== "internal") notFound();
  const { location, rows } = data;
  const manager = canManage(ctx.role);
  const moves = await listMoves(db, ctx.org.id, { locationId: id, limit: 30 });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={
          <Link href="/locations" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-text">
            <ChevronLeft className="size-4" aria-hidden /> Locations
          </Link>
        }
        title={location.name}
        description={location.fullName}
      />

      <div className="flex flex-col gap-6">
        <section className="card overflow-hidden" aria-labelledby="contents">
          <div className="border-b border-border px-4 py-3">
            <h2 id="contents" className="section-title">What’s here</h2>
            <p className="text-sm text-muted">Includes stock in sections inside this location.</p>
          </div>
          {rows.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={<Package className="size-6" aria-hidden />} title="Empty" description="No stock is stored here yet." />
            </div>
          ) : (
            <ul>
              {rows.map((r) => (
                <li key={`${r.productId}-${r.locationId}`} className="border-b border-border last:border-0">
                  <Link href={`/products/${r.productId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.productName}</span>
                      <span className="block truncate text-xs text-muted">
                        {r.locationName}
                        {r.sku ? ` · ${r.sku}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatQty(r.quantity)} {r.uom}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden" aria-labelledby="loc-history">
          <div className="border-b border-border px-4 py-3">
            <h2 id="loc-history" className="section-title">Recent movements</h2>
          </div>
          <MoveList moves={moves} />
        </section>

        {manager ? (
          <section className="card flex flex-col gap-5 p-5" aria-labelledby="manage-loc">
            <h2 id="manage-loc" className="section-title">Manage</h2>
            <NewLocationForm parents={[{ id: location.id, fullName: location.fullName }]} defaultParentId={location.id} />
            <RenameLocationForm id={location.id} name={location.name} />
            <ActionButton
              action={archiveLocationAction}
              fields={{ id: location.id }}
              className="btn-danger btn-sm self-start"
              confirm={`Archive ${location.fullName} and its sections?`}
            >
              <Archive className="size-4" aria-hidden /> Archive location
            </ActionButton>
          </section>
        ) : null}
      </div>
    </div>
  );
}
