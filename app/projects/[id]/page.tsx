import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/profile";
import { getAllData, getMyWeek, getPhaseLibrary, getProjectEntries, getTeamWeek, isUuid } from "@/lib/data";
import { buildStats, forecast, targetFromStats } from "@/lib/forecast";
import { addDays, mondayOf, shortDate, ymdInTz } from "@/lib/dates";
import { hoursText, money, pct, statusLabel } from "@/lib/options";
import UsageBar from "@/components/ui/UsageBar";
import ForecastCard from "@/components/projects/ForecastCard";
import Timesheet from "@/components/projects/Timesheet";
import PhaseEditor from "@/components/projects/PhaseEditor";
import ProjectDetailsForm from "@/components/projects/ProjectDetailsForm";
import HoursBreakdown from "@/components/projects/HoursBreakdown";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ tab?: string; week?: string }>;

const TABS = [
  { key: "time", label: "Timesheet" },
  { key: "hours", label: "Hours" },
  { key: "phases", label: "Phases" },
  { key: "details", label: "Details" },
] as const;

export default function ProjectPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<p className="px-6 py-10 text-moa-muted sm:px-10">Loading project…</p>}>
        <ProjectContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ProjectContent({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const { id } = await params;
  if (!isUuid(id)) notFound();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "time";

  const today = ymdInTz(new Date(), profile.timezone || "UTC");
  const weekStart = mondayOf(sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : today);
  const weekEnd = addDays(weekStart, 6);

  const [{ projects, phases, weeks }, library, mine, team, entries] = await Promise.all([
    getAllData(),
    getPhaseLibrary(),
    tab === "time" ? getMyWeek(id, profile.id, weekStart, weekEnd) : Promise.resolve([]),
    tab === "time" ? getTeamWeek(id, weekStart, weekEnd) : Promise.resolve([]),
    tab === "hours" ? getProjectEntries(id) : Promise.resolve([]),
  ]);

  const stats = buildStats(projects, phases, weeks, today);
  const s = stats.find((x) => x.project.id === id);
  if (!s) notFound();
  const p = s.project;
  const f = forecast(targetFromStats(s), stats);
  const remaining = s.budget !== null ? s.budget - s.amount : null;

  const tabHref = (key: string) => (key === "time" ? `/projects/${id}` : `/projects/${id}?tab=${key}`);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-10">
      <Link href="/" className="text-sm text-moa-muted hover:text-moa-text">
        All projects
      </Link>

      {/* Title */}
      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-4 text-4xl font-medium sm:text-5xl">
            <span aria-hidden className="h-4 w-4 shrink-0" style={{ background: p.color || "#e4e4e4" }} />
            <span className="min-w-0 break-words">{p.name}</span>
          </h1>
          <p className="mt-2 flex flex-wrap gap-x-5 text-moa-muted">
            {p.client_name && <span>{p.client_name}</span>}
            {p.project_type && <span>{p.project_type}</span>}
            <span>{statusLabel(p.status)}</span>
            {p.hourly_rate > 0 && <span>{money(p.hourly_rate)} per hour</span>}
          </p>
        </div>
      </header>

      {/* Numbers */}
      <section className="mt-8 grid gap-6 border-y border-moa-line py-6 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Budget" value={money(s.budget)} sub={s.budgetHours !== null ? hoursText(Math.round(s.budgetHours)) : "No budget set"} />
        <Stat label="Logged" value={money(s.amount)} sub={hoursText(s.hours)} />
        <Stat
          label="Remaining"
          value={remaining !== null ? money(remaining) : "—"}
          sub={remaining !== null && p.hourly_rate > 0 ? hoursText(Math.round(remaining / p.hourly_rate)) : undefined}
          warn={remaining !== null && remaining < 0}
        />
        <div>
          <p className="text-sm text-moa-muted">Timeline</p>
          <p className="mt-1 text-2xl font-medium">
            {p.start_date ? shortDate(p.start_date) : "—"} – {p.end_date ? shortDate(p.end_date, true) : "—"}
          </p>
          <div className="mt-3">
            <UsageBar used={s.usedPct} elapsed={s.elapsedPct} />
          </div>
          <p className="mt-2 text-sm text-moa-muted">
            {s.usedPct !== null ? `${pct(s.usedPct)} of budget used` : "No budget"}
            {s.elapsedPct !== null && `, ${pct(Math.min(s.elapsedPct, 9.99))} of time passed`}
          </p>
        </div>
      </section>

      <ForecastCard forecast={f} />

      {/* Tabs */}
      <nav aria-label="Project sections" className="mt-10 flex gap-8 border-b border-moa-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            scroll={false}
            aria-current={tab === t.key ? "page" : undefined}
            className={`-mb-px border-b-2 pb-3 text-xl font-medium transition-colors ${
              tab === t.key ? "border-moa-text" : "border-transparent text-moa-muted hover:text-moa-text"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="py-8">
        {tab === "time" && (
          <Timesheet
            key={weekStart}
            projectId={id}
            weekStart={weekStart}
            today={today}
            phases={s.phases.map((ph) => ({
              id: ph.phase.id,
              name: ph.phase.name,
              is_complete: ph.phase.is_complete,
              totalHours: ph.hours,
            }))}
            initialCells={mine}
            team={team}
          />
        )}
        {tab === "hours" && (
          <HoursBreakdown
            projectName={p.name}
            entries={entries}
            phases={s.phases.map((ph) => ({ id: ph.phase.id, name: ph.phase.name }))}
            currentUserId={profile.id}
          />
        )}
        {tab === "phases" && (
          <PhaseEditor
            projectId={id}
            phases={s.phases.map((ph) => ({ ...ph.phase, hours: ph.hours, amount: ph.amount }))}
            projectBudget={s.budget}
            hourlyRate={p.hourly_rate}
            tags={library.tags}
            sets={library.sets}
          />
        )}
        {tab === "details" && (
          <ProjectDetailsForm project={p} projectTypes={[...new Set(projects.map((x) => x.project_type).filter((t): t is string => !!t))]} />
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div>
      <p className="text-sm text-moa-muted">{label}</p>
      <p className={`mt-1 text-2xl font-medium ${warn ? "text-[#c98f8f]" : ""}`}>{value}</p>
      {sub && <p className="text-sm text-moa-muted">{sub}</p>}
    </div>
  );
}
