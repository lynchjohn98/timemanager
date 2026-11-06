"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import type { AuthState } from "@/app/auth/actions";

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
  hint?: string;
};

function FormField({ label, name, type = "text", autoComplete, required = true, defaultValue, hint }: FieldProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-moa-muted">{label}</span>
      <input
        type={type}
        name={name}
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultValue}
        className="border-b border-moa-line bg-transparent py-2 text-lg font-medium outline-none transition-colors focus:border-moa-text"
      />
      {hint && <span className="text-xs text-moa-muted">{hint}</span>}
    </label>
  );
}

/** Access code, filled in automatically from an invite link (?code=…). */
function CodeField() {
  const code = useSearchParams().get("code") ?? "";
  return (
    <FormField
      label="Access code"
      name="code"
      required={false}
      defaultValue={code}
      hint="From your invite. Without a code you'll have an account but no projects until someone adds you."
    />
  );
}

type AuthFormProps = {
  title: string;
  submitLabel: string;
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
  showName?: boolean;
  showCode?: boolean;
  footer: React.ReactNode;
};

export default function AuthForm({ title, submitLabel, action, showName, showCode, footer }: AuthFormProps) {
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
        {showCode && (
          <Suspense fallback={<FormField label="Access code" name="code" required={false} />}>
            <CodeField />
          </Suspense>
        )}

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
