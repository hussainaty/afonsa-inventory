"use client";

import { useEffect } from "react";

/** Keeps the navigation on screen when a page inside the app fails to load. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="card mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold tracking-tight">This page couldn’t load</h1>
      <p className="mt-2 text-sm text-muted">
        Check your connection and try again. If you just saved something, open the item to confirm whether it went
        through before repeating it.
        {error.digest ? <span className="mt-2 block font-mono text-xs">Ref: {error.digest}</span> : null}
      </p>
      <button type="button" onClick={reset} className="btn-primary mt-6">
        Try again
      </button>
    </div>
  );
}
