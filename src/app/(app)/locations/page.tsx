import { ChevronRight, MapPin, Warehouse } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NewLocationForm, NewWarehouseForm } from "@/components/forms/location-forms";
import { PageHeader } from "@/components/layout-bits";
import { db } from "@/db";
import { formatQty } from "@/lib/format";
import { canManage, requirePageContext } from "@/server/context";
import { listInternalLocations, listWarehouses } from "@/server/locations";

export const metadata: Metadata = { title: "Locations" };

export default async function LocationsPage() {
  const ctx = await requirePageContext();
  const [warehouses, locations] = await Promise.all([
    listWarehouses(db, ctx.org.id),
    listInternalLocations(db, ctx.org.id),
  ]);
  const manager = canManage(ctx.role);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Locations"
        description="Warehouses contain locations and sections (shelves, aisles, bins). Stock is tracked in each one."
      />

      {manager ? (
        <section className="card mb-6 p-5" aria-labelledby="new-loc">
          <h2 id="new-loc" className="section-title mb-4">Add a section</h2>
          <NewLocationForm parents={locations} defaultParentId={locations[0]?.id} />
        </section>
      ) : null}

      <div className="flex flex-col gap-6">
        {warehouses.map((wh) => {
          const locs = locations.filter((l) => l.warehouseId === wh.id);
          return (
            <section key={wh.id} className="card overflow-hidden" aria-labelledby={`wh-${wh.id}`}>
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Warehouse className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 id={`wh-${wh.id}`} className="section-title">
                    {wh.name} <span className="font-mono text-xs font-normal text-muted">{wh.code}</span>
                  </h2>
                  {wh.address ? <p className="truncate text-xs text-muted">{wh.address}</p> : null}
                </div>
              </div>
              <ul>
                {locs.map((l) => {
                  const depth = l.fullName.split("/").length - 2;
                  return (
                    <li key={l.id} className="border-b border-border last:border-0">
                      <Link href={`/locations/${l.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-surface-2">
                        <span className="flex min-w-0 flex-1 items-center gap-2" style={{ paddingLeft: depth * 18 }}>
                          <MapPin className="size-4 shrink-0 text-muted" aria-hidden />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{l.name}</span>
                            <span className="block truncate text-xs text-muted">{l.fullName}</span>
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-xs text-muted tabular-nums">
                          {l.productCount} products
                          <br />
                          {formatQty(l.totalQuantity)} units
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {manager ? (
        <section className="card mt-6 p-5" aria-labelledby="new-wh">
          <h2 id="new-wh" className="section-title mb-4">Add a warehouse or site</h2>
          <NewWarehouseForm />
        </section>
      ) : null}
    </div>
  );
}
