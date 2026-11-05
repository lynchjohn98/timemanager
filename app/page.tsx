import { Suspense } from "react";
import Link from "next/link";
import { getProfile } from "@/lib/profile";
import { getAllData } from "@/lib/data";
import { buildStats, forecast, targetFromStats } from "@/lib/forecast";
import { addDays, mondayOf, ymdInTz } from "@/lib/dates";
import ProjectSheet, { type SheetRow } from "@/components/sheet/ProjectSheet";

type View = "active" | "completed" | "all";
type SearchParams = Promise<{ view?: string; weeks?: string }>;

const VIEWS: { key: View; label: string; empty: string }[] = [
  { key: "active", label: "Active", empty: "No active projects." },
  { key: "completed", label: "Completed", empty: "No completed projects yet." },
  { key: "all", label: "All", empty: "No projects yet." },
];

const WEEKS_SHOWN = 6;

export default function Home({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<p className="px-6 py-10 text-moa-muted sm:px-10">Loading projects…</p>}>
        <HomeContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function HomeContent({ searchParams }: { searchParams: SearchParams }) {
  const profile = await getProfile();
  if (!profile) return <SignedOut />;

  const params = await searchParams;
  const view = VIEWS.find((v) => v.key === params.view) ?? VIEWS[0];
  const today = ymdInTz(new Date(), profile.timezone || "UTC");

  // Week columns: the last 6 weeks, ending with this week (or shifted with ?weeks=-4 / 4)
  const shift = Math.max(-520, Math.min(520, Number.parseInt(params.weeks ?? "0", 10) || 0));
  const lastWeek = addDays(mondayOf(today), shift * 7);
  const weekColumns = Array.from({ length: WEEKS_SHOWN }, (_, i) => addDays(lastWeek, (i - WEEKS_SHOWN + 1) * 7));

  const { projects, phases, weeks } = await getAllData();
  const stats = buildStats(projects, phases, weeks, today);

  const inView = (status: string, v: View) =>
    v === "all" ? true : v === "completed" ? status === "completed" : status !== "completed";

  const rows: SheetRow[] = stats
    .filter((s) => inView(s.project.status, view.key))
    .map((s) => ({ stats: s, forecast: forecast(targetFromStats(s), stats) }));

  const link = (v: View, w: number) => {
    const q = new URLSearchParams();
    if (v !== "active") q.set("view", v);
    if (w !== 0) q.set("weeks", String(w));
    const s = q.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <section className="flex flex-1 flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4 border-b border-moa-line px-6 pt-6 sm:px-10">
        <nav aria-label="Project views" className="flex gap-8">
          {VIEWS.map((v) => {
            const active = v.key === view.key;
            const count = stats.filter((s) => inView(s.project.status, v.key)).length;
            return (
              <Link
                key={v.key}
                href={link(v.key, shift)}
                aria-current={active ? "page" : undefined}
                className={`-mb-px flex items-baseline gap-2 border-b-2 pb-3 text-xl font-medium transition-colors ${
                  active ? "border-moa-text" : "border-transparent text-moa-muted hover:text-moa-text"
                }`}
              >
                {v.label}
                <span className="text-sm text-moa-muted">{count}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-6 pb-3 text-sm font-medium">
          <div className="flex items-center gap-4 text-moa-muted">
            <span>Weeks</span>
            <Link href={link(view.key, shift - 4)} className="hover:text-moa-text">
              Earlier
            </Link>
            {shift !== 0 && (
              <Link href={link(view.key, 0)} className="hover:text-moa-text">
                This week
              </Link>
            )}
            <Link href={link(view.key, shift + 4)} className="hover:text-moa-text">
              Later
            </Link>
          </div>
          <Link
            href="/projects/new"
            className="border border-moa-text px-4 py-2 font-semibold transition-colors hover:bg-moa-text hover:text-moa-bg"
          >
            New project
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
          <p className="text-3xl font-medium">{view.empty}</p>
          <p className="max-w-md text-moa-muted">
            Create a project, give it phases and a budget, then log hours against each phase.
          </p>
          <Link
            href="/projects/new"
            className="mt-4 border border-moa-text px-6 py-3 text-lg font-semibold transition-colors hover:bg-moa-text hover:text-moa-bg"
          >
            New project
          </Link>
        </div>
      ) : (
        <ProjectSheet rows={rows} weekColumns={weekColumns} currentWeek={mondayOf(today)} today={today} />
      )}
    </section>
  );
}

function SignedOut() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-24 text-center">
      <h1 className="text-5xl font-medium tracking-wide sm:text-7xl">Projects and hours</h1>
      <p className="max-w-md text-lg text-moa-muted">
        Log in to track billable hours by project and phase, and see how each budget is holding up.
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="border border-moa-text bg-moa-text px-8 py-3 text-lg font-semibold text-moa-bg transition-opacity hover:opacity-80"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="border border-moa-text px-8 py-3 text-lg font-semibold transition-colors hover:bg-moa-text hover:text-moa-bg"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}
