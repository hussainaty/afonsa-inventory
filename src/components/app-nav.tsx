"use client";

import {
  ArrowLeftRight,
  Boxes,
  FolderTree,
  History,
  LayoutDashboard,
  Menu,
  RefreshCcw,
  ScanLine,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { switchWorkspaceAction } from "@/app/actions";
import { Brand } from "./brand";
import { SignOutButton } from "./sign-out-button";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Boxes },
  { href: "/operations", label: "Operations", icon: ArrowLeftRight },
  { href: "/locations", label: "Locations", icon: Warehouse },
  { href: "/categories", label: "Categories", icon: FolderTree },
  { href: "/replenishment", label: "Replenishment", icon: RefreshCcw },
  { href: "/history", label: "Stock history", icon: History },
  { href: "/team", label: "Team", icon: Users },
] as const;

type Props = {
  user: { name: string; email: string };
  org: { id: string; name: string };
  role: string;
  memberships: { orgId: string; name: string; role: string }[];
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function WorkspaceSwitcher({ org, memberships }: Pick<Props, "org" | "memberships">) {
  return (
    <form action={switchWorkspaceAction} className="flex flex-col gap-1.5">
      <label htmlFor="ws-switch" className="text-xs font-medium text-muted">
        Workspace
      </label>
      <select
        id="ws-switch"
        name="organizationId"
        defaultValue={org.id}
        className="input min-h-10"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {memberships.map((m) => (
          <option key={m.orgId} value={m.orgId}>
            {m.name}
          </option>
        ))}
      </select>
      <Link href="/onboarding" className="text-xs font-medium text-accent hover:underline">
        + New workspace
      </Link>
    </form>
  );
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-text"
              }`}
            >
              <Icon className="size-[18px]" aria-hidden />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function UserBlock({ user, role }: Pick<Props, "user" | "role">) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-muted">
          {user.email} · <span className="capitalize">{role}</span>
        </p>
      </div>
    </div>
  );
}

export function Sidebar(props: Props) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface p-4 lg:flex">
      <Link href="/dashboard" className="mb-6 px-1">
        <Brand />
      </Link>
      <div className="mb-5">
        <WorkspaceSwitcher org={props.org} memberships={props.memberships} />
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto">
        <NavLinks pathname={pathname} />
      </nav>
      <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
        <UserBlock user={props.user} role={props.role} />
        <SignOutButton className="btn-ghost btn-sm justify-start px-2" />
      </div>
    </aside>
  );
}

export function MobileNav(props: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const tabs = [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/products", label: "Products", icon: Boxes },
    { href: "/products?scan=1", label: "Scan", icon: ScanLine, primary: true },
    { href: "/operations", label: "Operations", icon: ArrowLeftRight },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
          <Brand compact />
          <span className="truncate text-sm font-semibold">{props.org.name}</span>
        </Link>
      </header>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {tabs.map(({ href, label, icon: Icon, primary }) => {
            const active = !primary && isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                    active ? "text-accent" : "text-muted"
                  }`}
                >
                  {primary ? (
                    <span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-contrast shadow-sm">
                      <Icon className="size-5" aria-hidden />
                    </span>
                  ) : (
                    <Icon className="size-5" aria-hidden />
                  )}
                  {primary ? <span className="sr-only">{label}</span> : label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              className="flex min-h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted"
            >
              <Menu className="size-5" aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialogRef.current && setOpen(false)}
        aria-label="Menu"
        className="m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-3xl border border-border bg-surface p-0 text-text lg:hidden"
      >
        <div className="flex flex-col gap-5 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <UserBlock user={props.user} role={props.role} />
            <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <WorkspaceSwitcher org={props.org} memberships={props.memberships} />
          <nav aria-label="All pages">
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
          </nav>
          <SignOutButton className="btn-secondary" />
        </div>
      </dialog>
    </>
  );
}
