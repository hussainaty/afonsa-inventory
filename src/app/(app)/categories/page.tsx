import { FolderTree, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { deleteCategoryAction } from "@/app/actions";
import { ActionButton } from "@/components/forms/action-button";
import { CategoryForm } from "@/components/forms/category-form";
import { EmptyState, PageHeader } from "@/components/layout-bits";
import { db } from "@/db";
import { listCategories } from "@/server/catalog";
import { canManage, requirePageContext } from "@/server/context";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const ctx = await requirePageContext();
  const categories = await listCategories(db, ctx.org.id);
  const manager = canManage(ctx.role);
  const parents = categories.map((c) => ({ id: c.id, path: c.path }));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Categories" description="Group products; categories can be nested (e.g. Tools / Power tools)." />

      {manager ? (
        <section className="card mb-6 p-5" aria-labelledby="new-cat">
          <h2 id="new-cat" className="section-title mb-4">New category</h2>
          <CategoryForm parents={parents} />
        </section>
      ) : null}

      {categories.length === 0 ? (
        <EmptyState
          icon={<FolderTree className="size-6" aria-hidden />}
          title="No categories yet"
          description={manager ? "Create your first category above." : "An admin can create categories for this workspace."}
        />
      ) : (
        <ul className="card overflow-hidden">
          {categories.map((c) => (
            <li key={c.id} className="border-b border-border last:border-0">
              <details className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <span style={{ paddingLeft: c.depth * 16 }} className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span className="size-3 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      {c.description ? <span className="block truncate text-xs text-muted">{c.description}</span> : null}
                    </span>
                  </span>
                  <Link
                    href={`/products?category=${c.id}`}
                    className="shrink-0 text-xs font-medium text-muted hover:text-accent"
                  >
                    {c.productCount} product{c.productCount === 1 ? "" : "s"}
                  </Link>
                  {manager ? <span className="text-xs text-accent group-open:hidden">Edit</span> : null}
                </summary>
                {manager ? (
                  <div className="flex flex-col gap-4 border-t border-border bg-surface-2/50 p-4">
                    <CategoryForm category={c} parents={parents} />
                    <ActionButton
                      action={deleteCategoryAction}
                      fields={{ id: c.id }}
                      className="btn-danger btn-sm self-start"
                      confirm={`Delete “${c.name}”? Its products become uncategorized and sub-categories move up a level.`}
                    >
                      <Trash2 className="size-4" aria-hidden /> Delete category
                    </ActionButton>
                  </div>
                ) : null}
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
