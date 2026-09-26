import { Archive, ArchiveRestore, ChevronLeft, Plus, Ruler, Trash2, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteProductAction, deleteReorderRuleAction, setProductActiveAction } from "@/app/actions";
import { ActionButton } from "@/components/forms/action-button";
import { ProductForm } from "@/components/forms/product-form";
import { ReorderForm } from "@/components/forms/reorder-form";
import { CategoryBadge, PageHeader } from "@/components/layout-bits";
import { MoveList } from "@/components/move-list";
import { ProductPhotos } from "@/components/product-photos";
import { StockPanel } from "@/components/stock-panel";
import { db } from "@/db";
import { formatMoney, formatQty } from "@/lib/format";
import { getProduct, listCategories, listSizes } from "@/server/catalog";
import { listProductImages } from "@/server/images";
import { canManage, requirePageContext } from "@/server/context";
import { listInternalLocations } from "@/server/locations";
import { listMoves, listReorderRules, productStockByLocation } from "@/server/reports";

export async function generateMetadata({ params }: PageProps<"/products/[id]">): Promise<Metadata> {
  const ctx = await requirePageContext();
  const found = await getProduct(db, ctx.org.id, (await params).id);
  const p = found?.product;
  return { title: p ? [p.name, p.variant].filter(Boolean).join(" · ") : "Product" };
}

export default async function ProductPage({ params, searchParams }: PageProps<"/products/[id]">) {
  const ctx = await requirePageContext();
  const { id } = await params;
  const sp = await searchParams;
  const found = await getProduct(db, ctx.org.id, id);
  if (!found) notFound();
  const { product } = found;
  const manager = canManage(ctx.role);

  const [stock, locations, categories, rules, moves, photos, sizes] = await Promise.all([
    productStockByLocation(db, ctx.org.id, id),
    listInternalLocations(db, ctx.org.id),
    listCategories(db, ctx.org.id),
    listReorderRules(db, ctx.org.id, id),
    listMoves(db, ctx.org.id, { productId: id, limit: 50 }),
    listProductImages(db, ctx.org.id, id),
    listSizes(db, ctx.org.id, product.name),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={
          <Link href="/products" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-text">
            <ChevronLeft className="size-4" aria-hidden /> Products
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-2">
            {product.name}
            {product.variant ? <span className="badge bg-accent-soft text-sm text-accent">{product.variant}</span> : null}
            {!product.active ? <span className="badge bg-warning-soft text-warning">Archived</span> : null}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <CategoryBadge name={found.categoryName} color={found.categoryColor} />
            {product.sku ? <span className="font-mono text-xs">SKU {product.sku}</span> : null}
            {product.barcode ? <span className="font-mono text-xs">· {product.barcode}</span> : null}
            <span className="text-xs">· Sale {formatMoney(product.salePriceCents)} · Cost {formatMoney(product.costCents)}</span>
          </span>
        }
      />

      {sp.created === "1" ? (
        <p role="status" className="mb-4 rounded-xl bg-success-soft px-4 py-3 text-sm text-success">
          Product created.{" "}
          <Link href="/products/new" className="font-semibold underline">
            Add another
          </Link>
        </p>
      ) : null}

      <div className="flex flex-col gap-6">
        <ProductPhotos productId={product.id} productName={product.name} images={photos} />

        <section className="card overflow-hidden" aria-labelledby="sizes-heading">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div>
              <h2 id="sizes-heading" className="section-title">Sizes of this part</h2>
              <p className="text-sm text-muted">Each size has its own stock, photos and codes.</p>
            </div>
            <Link href={`/products/new?from=${product.id}`} className="btn-secondary btn-sm">
              <Plus className="size-4" aria-hidden /> Add another size
            </Link>
          </div>
          <ul>
            {sizes.map((v) => (
              <li key={v.id} className="border-b border-border last:border-0">
                <Link
                  href={`/products/${v.id}`}
                  aria-current={v.id === product.id ? "page" : undefined}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-surface-2 ${v.id === product.id ? "bg-accent-soft/50" : ""}`}
                >
                  <Ruler className="size-4 shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {v.variant ?? "No size set"}
                    {v.id === product.id ? <span className="text-muted"> (this one)</span> : null}
                    {!v.active ? <span className="text-muted"> · archived</span> : null}
                  </span>
                  <span className="text-sm tabular-nums text-muted">
                    {formatQty(v.onHand)} {v.uom}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {product.active ? (
          <StockPanel
            productId={product.id}
            productName={product.name}
            uom={product.uom}
            stock={stock.map((s) => ({ locationId: s.locationId, fullName: s.fullName, quantity: s.quantity }))}
            locations={locations.map((l) => ({ id: l.id, fullName: l.fullName }))}
          />
        ) : null}

        <section className="card overflow-hidden" aria-labelledby="rr-heading">
          <div className="border-b border-border px-4 py-3">
            <h2 id="rr-heading" className="section-title">Reordering rules</h2>
            <p className="text-sm text-muted">Get flagged when stock at a location drops to its minimum; reorder up to its maximum.</p>
          </div>
          {rules.length > 0 ? (
            <ul>
              {rules.map((r) => (
                <li key={r.id} className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <span className="min-w-0 flex-1 truncate text-sm">{r.locationName}</span>
                  <span className="text-sm tabular-nums text-muted">
                    min {formatQty(r.minQuantity)} · max {formatQty(r.maxQuantity)}
                  </span>
                  {manager ? (
                    <ActionButton action={deleteReorderRuleAction} fields={{ id: r.id }} className="btn-ghost btn-sm size-9 px-0" showMessage={false}>
                      <X className="size-4" aria-label="Remove rule" />
                    </ActionButton>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {manager ? (
            <div className="p-4">
              <ReorderForm productId={product.id} uom={product.uom} locations={locations} />
            </div>
          ) : rules.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No rules yet. Ask an admin to set min/max levels.</p>
          ) : null}
        </section>

        <section className="card overflow-hidden" aria-labelledby="history-heading">
          <div className="border-b border-border px-4 py-3">
            <h2 id="history-heading" className="section-title">History</h2>
          </div>
          <MoveList moves={moves} showProduct={false} />
        </section>

        <section aria-labelledby="edit-heading">
          <h2 id="edit-heading" className="section-title mb-3">Edit product</h2>
          <ProductForm
            mode="edit"
            values={product}
            categories={categories.map((c) => ({ id: c.id, label: c.path }))}
          />
        </section>

        {manager ? (
          <section className="card flex flex-col gap-4 p-5" aria-labelledby="danger-heading">
            <div>
              <h2 id="danger-heading" className="section-title">Archive or delete</h2>
              <p className="text-sm text-muted">
                Archiving hides the product but keeps its history. Only products that have never moved can be deleted.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton
                action={setProductActiveAction}
                fields={{ id: product.id, active: String(!product.active) }}
                className="btn-secondary"
              >
                {product.active ? <Archive className="size-4" aria-hidden /> : <ArchiveRestore className="size-4" aria-hidden />}
                {product.active ? "Archive" : "Restore"}
              </ActionButton>
              <ActionButton
                action={deleteProductAction}
                fields={{ id: product.id }}
                className="btn-danger"
                confirm={`Delete “${product.name}” permanently?`}
              >
                <Trash2 className="size-4" aria-hidden /> Delete
              </ActionButton>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
