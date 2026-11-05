"use client";

import { startTransition, useActionState } from "react";
import type { ActionState } from "@/lib/options";

export const inputClass =
  "w-full border-b border-moa-line bg-moa-bg py-2 text-base font-medium outline-none transition-colors focus:border-moa-text";

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-sm text-moa-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-moa-muted">{hint}</span>}
    </label>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error) {
    return <p className="border border-red-400/40 px-4 py-3 text-sm text-red-300">{state.error}</p>;
  }
  if (state.message) {
    return <p className="text-sm text-moa-muted" role="status">{state.message}</p>;
  }
  return null;
}

export function SubmitButton({
  pending,
  children,
  pendingText = "Saving…",
  className,
}: {
  pending: boolean;
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={`border border-moa-text px-5 py-2.5 font-semibold transition-colors hover:bg-moa-text hover:text-moa-bg disabled:opacity-50 ${className ?? ""}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}

/**
 * Runs a server action from a form without clearing what was typed
 * (so a failed save keeps your input).
 */
export function useFormAction(
  action: (state: ActionState, formData: FormData) => Promise<ActionState>,
  initial: ActionState = { error: null }
) {
  const [state, dispatch, pending] = useActionState(action, initial);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => dispatch(formData));
  };
  return { state, pending, onSubmit };
}
