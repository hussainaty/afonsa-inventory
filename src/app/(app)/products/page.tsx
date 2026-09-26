import { Boxes, ImageIcon, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { CategoryBadge, EmptyState, PageHeader, StockBadge } from "@/components/layout-bits";
import { db } from "@/db";
import { formatMoney } from "@/lib/format";
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
  const filtered = Boolean(filters.q || filters.categoryId || filters.locationId || filters.stock || filters.archived);

  return (
    <>
      <PageHeader
        title="Products"
        description={`${products.length} ${filters.archived ? "archived " : ""}product${products.length === 1 ? "" : "s"}`}
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
            {products.map((p) => (
              <li key={p.id}>
                <Link href={`/products/${p.id}`} className="card flex items-center gap-3 p-3 active:bg-surface-2">
                  <Thumb id={thumbs.get(p.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {p.name}
                      {p.variant ? <span className="text-accent"> · {p.variant}</span> : null}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <CategoryBadge name={p.categoryName} color={p.categoryColor} />
                      {p.sku ? <span className="font-mono text-xs text-muted">{p.sku}</span> : null}
                    </div>
                  </div>
                  <StockBadge onHand={p.onHand} min={p.minQty} uom={p.uom} />
                </Link>
              </li>
            ))}
          </ul>

          <div className="card hidden overflow-x-auto md:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Category</th>
                  <th scope="col">SKU</th>
                  <th scope="col" className="text-right">
                    Price
                  </th>
                  <th scope="col" className="text-right">
                    On hand
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-2">
                    <td>
                      <Link href={`/products/${p.id}`} className="flex items-center gap-3 font-medium hover:text-accent">
                        <Thumb id={thumbs.get(p.id)} small />
                        <span>
                          {p.name}
                          {p.variant ? <span className="block text-xs font-normal text-accent">{p.variant}</span> : null}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <CategoryBadge name={p.categoryName} color={p.categoryColor} />
                    </td>
                    <td className="font-mono text-xs text-muted">{p.sku ?? "—"}</td>
                    <td className="text-right tabular-nums">{formatMoney(p.salePriceCents)}</td>
                    <td className="text-right">
                      <StockBadge onHand={p.onHand} min={p.minQty} uom={p.uom} />
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
