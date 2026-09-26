"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const res =
      mode === "sign-up"
        ? await authClient.signUp.email({ name: String(form.get("name") ?? "").trim(), email, password })
        : await authClient.signIn.email({ email, password });
    if (res.error) {
      setError(res.error.message ?? "Something went wrong. Please try again.");
      setPending(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  const other = mode === "sign-in" ? "/sign-up" : "/sign-in";
  const otherHref = next !== "/dashboard" ? `${other}?next=${encodeURIComponent(next)}` : other;

  return (
    <div className="card p-6">
      <h1 className="text-xl font-semibold tracking-tight">
        {mode === "sign-in" ? "Sign in" : "Create your account"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {mode === "sign-in"
          ? "Welcome back. Enter your details to continue."
          : "Start tracking your inventory in minutes."}
      </p>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        {mode === "sign-up" ? (
          <div className="field">
            <label htmlFor="name" className="label">
              Full name
            </label>
            <input id="name" name="name" required maxLength={80} autoComplete="name" className="input" />
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            className="input"
          />
        </div>
        <div className="field">
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            className="input"
          />
          {mode === "sign-up" ? <p className="hint">At least 8 characters.</p> : null}
        </div>
        {error ? (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {mode === "sign-in" ? "New here? " : "Already have an account? "}
        <Link href={otherHref} className="font-medium text-accent hover:underline">
          {mode === "sign-in" ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </div>
  );
}
