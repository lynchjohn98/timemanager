import { createClient } from "@/lib/supabase/server";
import type { ProjectStatus } from "@/lib/options";

// ---------------------------------------------------------------------
// Types (match the database tables)
// ---------------------------------------------------------------------
export type Project = {
  id: string;
  name: string;
  client_name: string | null;
  project_type: string | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  hourly_rate: number;
  budget_amount: number | null;
  color: string | null;
  notes: string | null;
  created_at: string;
};

export type Phase = {
  id: string;
  project_id: string;
  phase_tag_id: string | null;
  name: string;
  sort_order: number;
  budget_amount: number | null;
  is_complete: boolean;
};

/** Hours per phase per week (from the phase_week_hours view) */
export type WeekTotal = {
  project_id: string;
  phase_id: string;
  week_start: string; // Monday, "YYYY-MM-DD"
  hours: number;
  amount: number;
};

export type PhaseTag = { id: string; name: string; sort_order: number };
export type PhaseSet = {
  id: string;
  name: string;
  items: { phase_tag_id: string; name: string; sort_order: number; budget_share: number | null }[];
};

export type TimeCell = { phase_id: string; work_date: string; hours: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Supabase returns at most 1,000 rows per request; this keeps asking until it has them all. */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const size = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) {
      console.error("Loading data failed:", error.message);
      break;
    }
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < size) break;
  }
  return rows;
}

function cleanProject(p: Record<string, unknown>): Project {
  return {
    ...(p as unknown as Project),
    hourly_rate: Number(p.hourly_rate ?? 0),
    budget_amount: num(p.budget_amount),
  };
}

function cleanPhase(p: Record<string, unknown>): Phase {
  return { ...(p as unknown as Phase), budget_amount: num(p.budget_amount) };
}

// ---------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------

/** Every project, phase and weekly total — used by the main sheet and the forecast. */
export async function getAllData() {
  const supabase = await createClient();

  const [projects, phases, weeks] = await Promise.all([
    fetchAll<Record<string, unknown>>((a, b) =>
      supabase
        .from("projects")
        .select("id, name, client_name, project_type, status, start_date, end_date, hourly_rate, budget_amount, color, notes, created_at")
        .order("start_date", { ascending: false, nullsFirst: true })
        .range(a, b)
    ),
    fetchAll<Record<string, unknown>>((a, b) =>
      supabase
        .from("phases")
        .select("id, project_id, phase_tag_id, name, sort_order, budget_amount, is_complete")
        .order("sort_order")
        .range(a, b)
    ),
    fetchAll<Record<string, unknown>>((a, b) =>
      supabase.from("phase_week_hours").select("project_id, phase_id, week_start, hours, amount").range(a, b)
    ),
  ]);

  return {
    projects: projects.map(cleanProject),
    phases: phases.map(cleanPhase),
    weeks: weeks.map((w) => ({ ...(w as unknown as WeekTotal), hours: Number(w.hours), amount: Number(w.amount) })),
  };
}

/** The phase library: reusable phase names and saved sets. */
export async function getPhaseLibrary() {
  const supabase = await createClient();

  const [tags, sets] = await Promise.all([
    supabase.from("phase_tags").select("id, name, sort_order").order("sort_order"),
    supabase
      .from("phase_sets")
      .select("id, name, items:phase_set_items(phase_tag_id, sort_order, budget_share, tag:phase_tags(name))")
      .order("name"),
  ]);

  if (tags.error) console.error("Loading phase tags failed:", tags.error.message);
  if (sets.error) console.error("Loading phase sets failed:", sets.error.message);

  type RawSet = {
    id: string;
    name: string;
    items: { phase_tag_id: string; sort_order: number; budget_share: number | null; tag: { name: string } | null }[];
  };

  return {
    tags: (tags.data ?? []) as PhaseTag[],
    sets: ((sets.data ?? []) as unknown as RawSet[]).map((s) => ({
      id: s.id,
      name: s.name,
      items: s.items
        .map((i) => ({
          phase_tag_id: i.phase_tag_id,
          name: i.tag?.name ?? "",
          sort_order: i.sort_order,
          budget_share: num(i.budget_share),
        }))
        .sort((a, b) => a.sort_order - b.sort_order),
    })) as PhaseSet[],
  };
}

/** One person's hours on one project for one week (for the timesheet grid). */
export async function getMyWeek(projectId: string, userId: string, weekStart: string, weekEnd: string) {
  if (!UUID.test(projectId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_entries")
    .select("phase_id, work_date, hours")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .gte("work_date", weekStart)
    .lte("work_date", weekEnd);
  if (error) console.error("Loading hours failed:", error.message);
  return (data ?? []).map((r) => ({ ...r, hours: Number(r.hours) })) as TimeCell[];
}

/** Everyone's hours on one project for one week, by person (shown under the grid). */
export async function getTeamWeek(projectId: string, weekStart: string, weekEnd: string) {
  if (!UUID.test(projectId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_entries")
    .select("hours, user:profiles!time_entries_user_id_fkey(id, name)")
    .eq("project_id", projectId)
    .gte("work_date", weekStart)
    .lte("work_date", weekEnd);
  if (error) console.error("Loading team hours failed:", error.message);

  const byPerson = new Map<string, { name: string; hours: number }>();
  for (const r of (data ?? []) as unknown as { hours: number; user: { id: string; name: string | null } | null }[]) {
    const id = r.user?.id ?? "unknown";
    const entry = byPerson.get(id) ?? { name: r.user?.name ?? "Someone", hours: 0 };
    entry.hours += Number(r.hours);
    byPerson.set(id, entry);
  }
  return [...byPerson.values()].sort((a, b) => b.hours - a.hours);
}

export const isUuid = (id: string) => UUID.test(id);
