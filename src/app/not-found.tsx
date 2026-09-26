import Link from "next/link";
import { CenteredShell } from "@/components/brand";

export default function NotFound() {
  return (
    <CenteredShell>
      <div className="card p-6">
        <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted">It may have been moved, archived, or belongs to another workspace.</p>
        <Link href="/dashboard" className="btn-primary mt-6">
          Back to dashboard
        </Link>
      </div>
    </CenteredShell>
  );
}
