import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/profile";
import { logout } from "@/app/auth/actions";
import Avatar from "@/components/Avatar";
import JoinWithCode from "@/components/JoinWithCode";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-moa-line py-5 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-moa-muted">{label}</span>
      <span className="break-all text-lg font-medium">{value}</span>
    </div>
  );
}

async function AccountDetails() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-10">
      <Avatar name={profile.name} src={profile.avatar_url} size={120} />

      <div className="text-center">
        <h1 className="text-5xl font-medium tracking-wide">{profile.name || "My Account"}</h1>
        <p className="mt-3 text-lg font-medium text-moa-muted">{profile.email}</p>
      </div>

      <div className="w-full border-t-2 border-moa-text">
        <Row label="Name" value={profile.name || "—"} />
        <Row label="Email" value={profile.email || "—"} />
        <Row label="Access" value={profile.app_role === "admin" ? "Admin: creates projects and invites people" : "Team member: logs hours on projects you're invited to"} />
        <Row label="Timezone" value={profile.timezone.replace(/_/g, " ")} />
        <Row label="Member since" value={formatDate(profile.created_at)} />
      </div>

      <JoinWithCode />

      <form action={logout}>
        <button
          type="submit"
          className="border border-moa-text px-10 py-3 text-lg font-semibold tracking-wide transition-colors hover:bg-moa-text hover:text-moa-bg"
        >
          Log Out
        </button>
      </form>
    </div>
  );
}

export default function AccountPage() {
  return (
    <main className="flex flex-1 justify-center px-6 py-12 pb-24">
      <Suspense fallback={<p className="text-moa-muted">Loading…</p>}>
        <AccountDetails />
      </Suspense>
    </main>
  );
}
