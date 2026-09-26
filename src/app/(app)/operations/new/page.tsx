import { Boxes, ChevronLeft, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OperationForm } from "@/components/forms/operation-form";
import { EmptyState, PageHeader } from "@/components/layout-bits";
import { db } from "@/db";
import { listProducts } from "@/server/catalog";
import { itemName } from "@/lib/format";
import { requirePageContext } from "@/server/context";
import { listInternalLocations } from "@/server/locations";

export const metadata: Metadata = { title: "New operation" };

export default async function NewOperationPage({ searchParams }: PageProps<"/operations/new">) {
  const ctx = await requirePageContext();
  const sp = await searchParams;
  const type = (["receipt", "delivery", "internal"] as const).find((t) => t === sp.type) ?? "receipt";
  const [products, locations] = await Promise.all([
    listProducts(db, ctx.org.id),
    listInternalLocations(db, ctx.org.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={
          <Link href="/operations" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-text">
            <ChevronLeft className="size-4" aria-hidden /> Operations
          </Link>
        }
        title="New operation"
      />
      {products.length === 0 ? (
        <EmptyState
          icon={<Boxes className="size-6" aria-hidden />}
          title="Add a product first"
          description="Operations move products between locations, so you need at least one product."
          action={
            <Link href="/products/new" className="btn-primary">
              <Plus className="size-4" aria-hidden /> Add product
            </Link>
          }
        />
      ) : (
        <OperationForm
          defaultType={type}
          products={products.map((p) => ({ id: p.id, label: [itemName(p.name, p.variant), p.sku && `(${p.sku})`].filter(Boolean).join(" "), uom: p.uom }))}
          locations={locations.map((l) => ({ id: l.id, fullName: l.fullName }))}
        />
      )}
    </div>
  );
}
