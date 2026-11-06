import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/profile";
import { getPhaseLibrary } from "@/lib/data";
import PhaseLibrary from "@/components/phases/PhaseLibrary";

export default function PhasesPage() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<p className="px-6 py-10 text-moa-muted sm:px-10">Loading…</p>}>
        <Library />
      </Suspense>
    </main>
  );
}

async function Library() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.app_role !== "admin") redirect("/");
  const { tags, sets } = await getPhaseLibrary();

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-10">
      <h1 className="text-4xl font-medium sm:text-5xl">Phase library</h1>
      <p className="mt-3 max-w-prose text-moa-muted">
        Phase names you use are saved here so you can pick them on any project. Phase sets are saved lists of phases
        you can apply to a new project in one click.
      </p>
      <PhaseLibrary tags={tags} sets={sets} />
    </div>
  );
}
