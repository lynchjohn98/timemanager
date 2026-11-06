"use client";

import { useActionState } from "react";
import { redeemCode } from "@/app/auth/actions";

/** Enter an invite code to join another project (or an admin code to get admin access). */
export default function JoinWithCode() {
  const [state, formAction, pending] = useActionState(redeemCode, { error: null, message: null });

  return (
    <form action={formAction} className="w-full border border-moa-line p-6">
      <h2 className="text-2xl font-medium">Join a project</h2>
      <p className="mt-1 text-sm text-moa-muted">Got a new invite code? Enter it here to join that project.</p>
      <div className="mt-5 flex items-end gap-3">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm text-moa-muted">Code</span>
          <input
            name="code"
            required
            autoComplete="off"
            className="h-12 border-b border-moa-line bg-transparent text-lg font-medium uppercase tracking-widest outline-none focus:border-moa-text"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="h-12 border border-moa-text px-5 font-semibold transition-colors hover:bg-moa-text hover:text-moa-bg disabled:opacity-50"
        >
          {pending ? "Joining…" : "Join"}
        </button>
      </div>
      {state.error && <p className="mt-4 text-sm text-red-300">{state.error}</p>}
      {state.message && (
        <p role="status" className="mt-4 text-sm text-moa-muted">
          {state.message}
        </p>
      )}
    </form>
  );
}
