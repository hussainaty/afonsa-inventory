import { Boxes, ImageIcon, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { CategoryBadge, EmptyState, PageHeader, StockBadge } from "@/components/layout-bits";
import { db } from "@/db";
import { formatQty } from "@/lib/format";
import { listCategories, listProducts, type ProductFilters } from "@/server/catalog";
import { requirePageContext } from "@/server/context";
import { mainImageIds } from "@/server/images";
import { listInternalLocations } from "@/server/locations";

export const metadata: Metadata = { title: "Products" };

const STOCK_FILTERS = [
  { value: "", label: "All stock" },
  { value: "in", label: "In stock" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out of stock" },
] as const;

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const ctx = await requirePageContext();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const filters: ProductFilters = {
    q: str("q"),
    categoryId: str("category") || undefined,
    locationId: str("location") || undefined,
    stock: (["low", "out", "in"] as const).find((s) => s === str("stock")),
    archived: str("archived") === "1",
  };

  const [products, categories, locations] = await Promise.all([
    listProducts(db, ctx.org.id, filters),
    listCategories(db, ctx.org.id),
    listInternalLocations(db, ctx.org.id),
  ]);
  const thumbs = await mainImageIds(db, ctx.org.id, products.map((p) => p.id));
  // One row per item; its sizes (variants) are listed inside the row.
  const byFamily = new Map<string, typeof products>();
  for (const p of products) byFamily.set(p.familyId, [...(byFamily.get(p.familyId) ?? []), p]);
  const items = [...byFamily.entries()].map(([familyId, sizes]) => ({
    familyId,
    sizes,
    name: sizes[0].name,
    uom: sizes[0].uom,
    categoryName: sizes[0].categoryName,
    categoryColor: sizes[0].categoryColor,
    hasSizes: sizes.length > 1 || sizes.some((s) => s.variant),
    onHand: sizes.reduce((n, s) => n + s.onHand, 0),
    minQty: sizes.reduce((n, s) => n + s.minQty, 0),
    thumb: sizes.map((s) => thumbs.get(s.id)).find(Boolean),
  }));
  const filtered = Boolean(filters.q || filters.categoryId || filters.locationId || filters.stock || filters.archived);

  return (
    <>
      <PageHeader
        title="Products"
        description={`${items.length} ${filters.archived ? "archived " : ""}item${items.length === 1 ? "" : "s"}`}
        actions={
          <>
            <BarcodeScanner autoOpen={str("scan") === "1"} />
            <Link href="/products/new" className="btn-primary">
              <Plus className="size-4" aria-hidden /> Add product
            </Link>
          </>
        }
      />

      <form className="card mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]" role="search">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="q" className="sr-only">
            Search products
          </label>
          <input id="q" name="q" defaultValue={filters.q} placeholder="Search name, SKU or barcode" className="input pl-9" type="search" />
        </div>
        <label className="sr-only" htmlFor="category">
          Category
        </label>
        <select id="category" name="category" defaultValue={filters.categoryId ?? ""} className="input">
          <option value="">All categories</option>
          <option value="none">Uncategorized</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.path}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="location">
          Location
        </label>
        <select id="location" name="location" defaultValue={filters.locationId ?? ""} className="input">
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.fullName}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="stock">
          Stock level
        </label>
        <select id="stock" name="stock" defaultValue={filters.stock ?? ""} className="input">
          {STOCK_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1">
            Filter
          </button>
          {filtered ? (
            <Link href="/products" className="btn-ghost">
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {products.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={<Search className="size-6" aria-hidden />}
            title="No matching products"
            description="Try a different search or clear the filters."
            action={
              <Link href="/products" className="btn-secondary">
                Clear filters
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<Boxes className="size-6" aria-hidden />}
            title="No products yet"
            description="Add products with a category, location and quantity. You can also scan a barcode to create one."
            action={
              <Link href="/products/new" className="btn-primary">
                <Plus className="size-4" aria-hidden /> Add product
              </Link>
            }
          />
        )
      ) : (
        <>
          <ul className="flex flex-col gap-2 md:hidden">
            {items.map((it) => (
              <li key={it.familyId}>
                <Link href={`/products/${it.sizes[0].id}`} className="card flex items-center gap-3 p-3 active:bg-surface-2">
                  <Thumb id={it.thumb} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{it.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <CategoryBadge name={it.categoryName} color={it.categoryColor} />
                      {it.hasSizes
                        ? it.sizes.map((s) => (
                            <span key={s.id} className="badge bg-surface-2 text-text tabular-nums">
                              {s.variant ?? "Standard"} · {formatQty(s.onHand)}
                            </span>
                          ))
                        : null}
                    </div>
                  </div>
                  <StockBadge onHand={it.onHand} min={it.minQty} uom={it.uom} />
                </Link>
              </li>
            ))}
          </ul>

          <div className="card hidden overflow-x-auto md:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Category</th>
                  <th scope="col">Sizes</th>
                  <th scope="col" className="text-right">
                    On hand
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.familyId} className="hover:bg-surface-2">
                    <td>
                      <Link href={`/products/${it.sizes[0].id}`} className="flex items-center gap-3 font-medium hover:text-accent">
                        <Thumb id={it.thumb} small />
                        <span>
                          {it.name}
                          {it.sizes[0].sku && !it.hasSizes ? (
                            <span className="block font-mono text-xs font-normal text-muted">{it.sizes[0].sku}</span>
                          ) : null}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <CategoryBadge name={it.categoryName} color={it.categoryColor} />
                    </td>
                    <td>
                      {it.hasSizes ? (
                        <span className="flex flex-wrap gap-1.5">
                          {it.sizes.map((s) => (
                            <Link
                              key={s.id}
                              href={`/products/${s.id}`}
                              className="badge bg-surface-2 text-text tabular-nums hover:bg-accent-soft hover:text-accent"
                            >
                              {s.variant ?? "Standard"} · {formatQty(s.onHand)}
                            </Link>
                          ))}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      <StockBadge onHand={it.onHand} min={it.minQty} uom={it.uom} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="mt-4 text-center text-sm">
        <Link href={filters.archived ? "/products" : "/products?archived=1"} className="text-muted hover:text-text hover:underline">
          {filters.archived ? "Show active products" : "Show archived products"}
        </Link>
      </p>
    </>
  );
}

function Thumb({ id, small = false }: { id?: string; small?: boolean }) {
  const size = small ? "size-10" : "size-14";
  if (!id)
    return (
      <span className={`grid ${size} shrink-0 place-items-center rounded-xl bg-surface-2 text-muted`}>
        <ImageIcon className="size-4" aria-hidden />
      </span>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element -- private, auth-gated image route
    <img src={`/api/images/${id}`} alt="" loading="lazy" className={`${size} shrink-0 rounded-xl bg-surface-2 object-cover`} />
  );
}
