import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/profile";
import { getAllData, getPhaseLibrary } from "@/lib/data";
import { buildStats } from "@/lib/forecast";
import { ymdInTz } from "@/lib/dates";
import NewProjectWizard from "@/components/projects/NewProjectWizard";

export default function NewProjectPage() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<p className="px-6 py-10 text-moa-muted sm:px-10">Loading…</p>}>
        <Wizard />
      </Suspense>
    </main>
  );
}

async function Wizard() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const today = ymdInTz(new Date(), profile.timezone || "UTC");
  const [library, { projects, phases, weeks }] = await Promise.all([getPhaseLibrary(), getAllData()]);
  const stats = buildStats(projects, phases, weeks, today);

  const types = [
    ...new Set(
      ["ADU", "Residential – New Build", "Residential – Remodel", "Commercial", ...projects.map((p) => p.project_type)]
        .filter((t): t is string => !!t)
    ),
  ];
  const lastRate = projects.find((p) => p.hourly_rate > 0)?.hourly_rate ?? null;

  return (
    <NewProjectWizard
      tags={library.tags}
      sets={library.sets}
      projectTypes={types}
      // Only finished projects are used for comparisons
      history={stats.filter((s) => s.project.status === "completed")}
      today={today}
      defaultRate={lastRate}
    />
  );
}
