import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProductForm } from "@/components/forms/product-form";
import { PageHeader } from "@/components/layout-bits";
import { db } from "@/db";
import { getProduct, listCategories } from "@/server/catalog";
import { requirePageContext } from "@/server/context";
import { listInternalLocations } from "@/server/locations";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage({ searchParams }: PageProps<"/products/new">) {
  const ctx = await requirePageContext();
  const sp = await searchParams;
  const barcode = typeof sp.barcode === "string" ? sp.barcode.slice(0, 64) : undefined;
  const fromId = typeof sp.from === "string" ? sp.from : null;
  const [categories, locations, source] = await Promise.all([
    listCategories(db, ctx.org.id),
    listInternalLocations(db, ctx.org.id),
    fromId ? getProduct(db, ctx.org.id, fromId) : null,
  ]);
  // "Add another size" copies the part's details; size, codes and stock are new.
  const base = source?.product;
  const values = base
    ? {
        name: base.name,
        categoryId: base.categoryId,
        uom: base.uom,
        costCents: base.costCents,
        salePriceCents: base.salePriceCents,
        description: base.description,
        barcode,
      }
    : { barcode };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={
          <Link href="/products" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-text">
            <ChevronLeft className="size-4" aria-hidden /> Products
          </Link>
        }
        title={base ? `Add another size of ${base.name}` : "Add product"}
        description={
          base
            ? "Details are copied from the existing size. Enter the new size and its stock."
            : barcode
              ? `No product uses the code ${barcode} yet. Create it now.`
              : undefined
        }
      />
      <ProductForm
        mode="create"
        values={values}
        categories={categories.map((c) => ({ id: c.id, label: c.path }))}
        locations={locations.map((l) => ({ id: l.id, label: l.fullName }))}
        defaultLocationId={locations[0]?.id}
      />
    </div>
  );
}
