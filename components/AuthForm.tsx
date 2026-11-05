"use client";

import { useActionState } from "react";
import type { AuthState } from "@/app/auth/actions";

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
};

function FormField({ label, name, type = "text", autoComplete }: FieldProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-moa-muted">{label}</span>
      <input
        type={type}
        name={name}
        autoComplete={autoComplete}
        required
        className="border-b border-moa-line bg-transparent py-2 text-lg font-medium outline-none transition-colors focus:border-moa-text"
      />
    </label>
  );
}

type AuthFormProps = {
  title: string;
  submitLabel: string;
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
  showName?: boolean;
  footer: React.ReactNode;
};

export default function AuthForm({ title, submitLabel, action, showName, footer }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, { error: null, message: null });

  if (state.message) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 pb-24">
        <div className="flex max-w-sm flex-col gap-6 text-center">
          <h1 className="text-5xl font-medium tracking-wide">Almost there</h1>
          <p className="text-lg font-medium text-moa-muted">{state.message}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <form action={formAction} className="flex w-full max-w-sm flex-col gap-8">
        <h1 className="text-center text-5xl font-medium tracking-wide">{title}</h1>

        {showName && <FormField label="Name" name="name" autoComplete="name" />}
        <FormField label="Email" name="email" type="email" autoComplete="email" />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete={showName ? "new-password" : "current-password"}
        />

        {state.error && (
          <p className="border border-red-400/40 px-4 py-3 text-sm text-red-300">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-4 border border-moa-text py-3 text-lg font-semibold tracking-wide transition-colors hover:bg-moa-text hover:text-moa-bg disabled:opacity-50"
        >
          {pending ? "Please wait…" : submitLabel}
        </button>

        <p className="text-center text-sm text-moa-muted">{footer}</p>
      </form>
    </main>
  );
}
