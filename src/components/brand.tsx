import { Boxes } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-contrast">
        <Boxes className="size-5" aria-hidden />
      </span>
      {compact ? null : <span className="text-base font-semibold tracking-tight">Afonsa Inventory</span>}
    </span>
  );
}

export function CenteredShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className={`w-full ${wide ? "max-w-md" : "max-w-sm"}`}>
        <div className="mb-8">
          <Brand />
        </div>
        {children}
      </div>
    </main>
  );
}
