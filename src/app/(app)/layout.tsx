import { MobileNav, Sidebar } from "@/components/app-nav";
import { requirePageContext } from "@/server/context";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await requirePageContext();
  const props = {
    user: { name: ctx.user.name, email: ctx.user.email },
    org: { id: ctx.org.id, name: ctx.org.name },
    role: ctx.role,
    memberships: ctx.memberships.map((m) => ({ orgId: m.orgId, name: m.name, role: m.role })),
  };
  return (
    <div className="flex min-h-dvh">
      <Sidebar {...props} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav {...props} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">
          {children}
        </main>
      </div>
    </div>
  );
}
