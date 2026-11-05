import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { signup } from "@/app/auth/actions";

export default function SignupPage() {
  return (
    <AuthForm
      title="Create Account"
      submitLabel="Sign Up"
      action={signup}
      showName
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-moa-text underline underline-offset-4">
            Log in
          </Link>
        </>
      }
    />
  );
}
