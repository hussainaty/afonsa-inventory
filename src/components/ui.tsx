"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/actions";

type ServerAction = (state: ActionState, form: FormData) => Promise<ActionState>;

/**
 * Binds a form to a server action without React's automatic form reset, so a
 * validation error never wipes what the user typed. Also refuses to submit
 * while offline, with a clear "nothing was saved" message.
 */
export function useServerForm(action: ServerAction) {
  const [serverState, dispatch, pending] = useActionState<ActionState, FormData>(action, {});
  const [localError, setLocalError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setLocalError("No connection — nothing was saved. Try again when you’re back online.");
      return;
    }
    setLocalError(null);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(event.currentTarget, submitter instanceof HTMLElement ? submitter : undefined);
    startTransition(() => dispatch(data));
  }

  const state: ActionState = localError ? { error: localError } : serverState;
  return { state, pending, formProps: { onSubmit } };
}

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText,
  pending: pendingProp,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  pendingText?: string;
  pending?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button type="submit" className={className} disabled={pending || rest.disabled} aria-busy={pending} {...rest}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error)
    return (
      <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{state.error}</span>
      </p>
    );
  if (state.ok && state.message)
    return (
      <p role="status" className="flex items-start gap-2 rounded-xl bg-success-soft px-3 py-2 text-sm text-success">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{state.message}</span>
      </p>
    );
  return null;
}

/** Resets a form after a successful submission. */
export function useResetOnSuccess(state: ActionState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return ref;
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}
