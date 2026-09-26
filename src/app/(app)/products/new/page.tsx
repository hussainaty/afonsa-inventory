import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProductForm } from "@/components/forms/product-form";
import { PageHeader } from "@/components/layout-bits";
import { db } from "@/db";
import { listCategories } from "@/server/catalog";
import { requirePageContext } from "@/server/context";
import { listInternalLocations } from "@/server/locations";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage({ searchParams }: PageProps<"/products/new">) {
  const ctx = await requirePageContext();
  const sp = await searchParams;
  const barcode = typeof sp.barcode === "string" ? sp.barcode.slice(0, 64) : undefined;
  const [categories, locations] = await Promise.all([
    listCategories(db, ctx.org.id),
    listInternalLocations(db, ctx.org.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={
          <Link href="/products" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-text">
            <ChevronLeft className="size-4" aria-hidden /> Products
          </Link>
        }
        title="Add product"
        description={barcode ? `No product uses the code ${barcode} yet. Create it now.` : undefined}
      />
      <ProductForm
        mode="create"
        values={{ barcode }}
        categories={categories.map((c) => ({ id: c.id, label: c.path }))}
        locations={locations.map((l) => ({ id: l.id, label: l.fullName }))}
        defaultLocationId={locations[0]?.id}
      />
    </div>
  );
}
