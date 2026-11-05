import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { login } from "@/app/auth/actions";

export default function LoginPage() {
  return (
    <AuthForm
      title="Log In"
      submitLabel="Log In"
      action={login}
      footer={
        <>
          No account yet?{" "}
          <Link href="/signup" className="text-moa-text underline underline-offset-4">
            Create one
          </Link>
        </>
      }
    />
  );
}
