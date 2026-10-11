/** Shown immediately on navigation so a tap always gets feedback on slow connections. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse">
      <div className="mb-2 h-8 w-48 rounded-lg bg-surface-2" />
      <div className="mb-6 h-4 w-64 max-w-full rounded bg-surface-2" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="card h-16" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
