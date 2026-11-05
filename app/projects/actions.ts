"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PROJECT_STATUSES, type ActionState } from "@/lib/options";
import type { TimeCell } from "@/lib/data";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim() || null;
const num = (fd: FormData, key: string) => {
  const v = text(fd, key);
  if (v === null) return null;
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};
const refresh = () => revalidatePath("/", "layout");

// ---------------------------------------------------------------------
// New project (from the wizard)
// ---------------------------------------------------------------------
export type NewProjectInput = {
  name: string;
  client_name: string;
  project_type: string;
  start_date: string;
  end_date: string;
  hourly_rate: number | null;
  budget_amount: number | null;
  color: string;
  phases: { name: string; budget_amount: number | null }[];
  save_set_name: string;
};

export async function createProject(input: NewProjectInput): Promise<ActionState> {
  if (!input.name.trim()) return { error: "Give the project a name." };
  if (input.start_date && input.end_date && input.end_date < input.start_date) {
    return { error: "The end date is before the start date." };
  }
  const names = input.phases.map((p) => p.name.trim().toLowerCase());
  if (names.some((n) => !n)) return { error: "Every phase needs a name." };
  if (new Set(names).size !== names.length) return { error: "Two phases have the same name." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_project", {
    p_project: {
      name: input.name,
      client_name: input.client_name,
      project_type: input.project_type,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      hourly_rate: input.hourly_rate ?? 0,
      budget_amount: input.budget_amount,
      color: input.color || null,
    },
    p_phases: input.phases.map((p) => ({ name: p.name.trim(), budget_amount: p.budget_amount })),
    p_save_set: input.save_set_name.trim() || null,
  });

  if (error) return { error: error.message };
  refresh();
  return { error: null, ok: true, id: data as string };
}

// ---------------------------------------------------------------------
// Project details
// ---------------------------------------------------------------------
export async function updateProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = text(formData, "id");
  const name = text(formData, "name");
  const status = text(formData, "status") ?? "active";
  const startDate = text(formData, "start_date");
  const endDate = text(formData, "end_date");
  const rate = num(formData, "hourly_rate");
  const budget = num(formData, "budget_amount");

  if (!id) return { error: "Missing project." };
  if (!name) return { error: "Give the project a name." };
  if (!PROJECT_STATUSES.some((s) => s.value === status)) return { error: "Pick a status." };
  if (startDate && endDate && endDate < startDate) return { error: "The end date is before the start date." };
  if (Number.isNaN(rate) || (rate !== null && rate < 0)) return { error: "The hourly rate must be a number." };
  if (Number.isNaN(budget) || (budget !== null && budget < 0)) return { error: "The budget must be a number." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      name,
      client_name: text(formData, "client_name"),
      project_type: text(formData, "project_type"),
      status,
      start_date: startDate,
      end_date: endDate,
      hourly_rate: rate ?? 0,
      budget_amount: budget,
      color: text(formData, "color"),
      notes: text(formData, "notes"),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  refresh();
  return { error: null, ok: true, message: "Saved." };
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient();
  await supabase.from("projects").delete().eq("id", projectId);
  refresh();
  redirect("/");
}

// ---------------------------------------------------------------------
// Timesheet
// ---------------------------------------------------------------------
export async function saveWeek(projectId: string, weekStart: string, cells: TimeCell[]): Promise<ActionState> {
  const bad = cells.find((c) => !Number.isFinite(c.hours) || c.hours < 0 || c.hours > 24);
  if (bad) return { error: "Hours must be between 0 and 24 for each day." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_week", {
    p_project_id: projectId,
    p_week_start: weekStart,
    p_cells: cells.filter((c) => c.hours > 0).map((c) => ({ ...c, hours: Math.round(c.hours * 100) / 100 })),
  });

  if (error) return { error: error.message };
  refresh();
  return { error: null, ok: true, message: "Hours saved." };
}

// ---------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------
export async function addPhase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const projectId = text(formData, "project_id");
  const name = text(formData, "name");
  const budget = num(formData, "budget_amount");
  if (!projectId) return { error: "Missing project." };
  if (!name) return { error: "Enter a phase name." };
  if (Number.isNaN(budget)) return { error: "The phase budget must be a number." };

  const supabase = await createClient();

  const { data: existing } = await supabase.from("phases").select("name, sort_order").eq("project_id", projectId);
  if (existing?.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return { error: `This project already has a phase called "${name}".` };
  }

  const { data: tagId, error: tagError } = await supabase.rpc("ensure_phase_tag", { p_name: name });
  if (tagError) return { error: tagError.message };

  const nextOrder = Math.max(0, ...(existing ?? []).map((p) => p.sort_order)) + 1;
  const { error } = await supabase
    .from("phases")
    .insert({ project_id: projectId, name, phase_tag_id: tagId, budget_amount: budget, sort_order: nextOrder });
  if (error) return { error: error.message };

  refresh();
  return { error: null, ok: true, message: `Added "${name}".` };
}

export async function updatePhase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = text(formData, "id");
  const name = text(formData, "name");
  const budget = num(formData, "budget_amount");
  if (!id) return { error: "Missing phase." };
  if (!name) return { error: "A phase needs a name." };
  if (Number.isNaN(budget)) return { error: "The phase budget must be a number." };

  const supabase = await createClient();
  const { data: tagId, error: tagError } = await supabase.rpc("ensure_phase_tag", { p_name: name });
  if (tagError) return { error: tagError.message };

  const { error } = await supabase
    .from("phases")
    .update({ name, phase_tag_id: tagId, budget_amount: budget, is_complete: formData.get("is_complete") === "on" })
    .eq("id", id);
  if (error) return { error: error.message };

  refresh();
  return { error: null, ok: true, message: "Saved." };
}

export async function movePhase(projectId: string, phaseId: string, direction: "up" | "down") {
  const supabase = await createClient();
  const { data } = await supabase.from("phases").select("id, sort_order").eq("project_id", projectId).order("sort_order");
  if (!data) return;

  const list = [...data];
  const i = list.findIndex((p) => p.id === phaseId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];

  await Promise.all(list.map((p, index) => supabase.from("phases").update({ sort_order: index + 1 }).eq("id", p.id)));
  refresh();
}

export async function deletePhase(phaseId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("phases").delete().eq("id", phaseId);
  if (error) {
    return {
      error:
        error.code === "23503"
          ? "This phase has hours logged against it. Clear those hours first, or mark the phase complete instead."
          : error.message,
    };
  }
  refresh();
  return { error: null, ok: true };
}

/** Add a saved phase set's phases to a project (skipping any it already has). */
export async function applyPhaseSet(projectId: string, setId: string): Promise<ActionState> {
  const supabase = await createClient();

  const [{ data: project }, { data: items }, { data: existing }] = await Promise.all([
    supabase.from("projects").select("budget_amount").eq("id", projectId).single(),
    supabase
      .from("phase_set_items")
      .select("phase_tag_id, sort_order, budget_share, tag:phase_tags(name)")
      .eq("set_id", setId)
      .order("sort_order"),
    supabase.from("phases").select("name, sort_order").eq("project_id", projectId),
  ]);

  const have = new Set((existing ?? []).map((p) => p.name.toLowerCase()));
  let order = Math.max(0, ...(existing ?? []).map((p) => p.sort_order));
  const budget = Number(project?.budget_amount ?? 0);

  const rows = ((items ?? []) as unknown as { phase_tag_id: string; budget_share: number | null; tag: { name: string } | null }[])
    .filter((i) => i.tag && !have.has(i.tag.name.toLowerCase()))
    .map((i) => ({
      project_id: projectId,
      phase_tag_id: i.phase_tag_id,
      name: i.tag!.name,
      sort_order: ++order,
      budget_amount: budget > 0 && i.budget_share !== null ? Math.round((budget * Number(i.budget_share)) / 100) : null,
    }));

  if (rows.length === 0) return { error: null, ok: true, message: "This project already has all of those phases." };

  const { error } = await supabase.from("phases").insert(rows);
  if (error) return { error: error.message };
  refresh();
  return { error: null, ok: true, message: `Added ${rows.length} phase${rows.length === 1 ? "" : "s"}.` };
}

/** Save this project's phases (and their share of the budget) as a reusable set. */
export async function savePhasesAsSet(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const projectId = text(formData, "project_id");
  const name = text(formData, "name");
  if (!projectId) return { error: "Missing project." };
  if (!name) return { error: "Name the phase set." };

  const supabase = await createClient();
  const [{ data: project }, { data: phases }] = await Promise.all([
    supabase.from("projects").select("budget_amount").eq("id", projectId).single(),
    supabase.from("phases").select("name, budget_amount").eq("project_id", projectId).order("sort_order"),
  ]);
  if (!phases?.length) return { error: "Add some phases first." };

  const budget = Number(project?.budget_amount ?? 0);
  const { error } = await supabase.rpc("save_phase_set", {
    p_name: name,
    p_phases: phases.map((p) => ({
      name: p.name,
      budget_share: budget > 0 && p.budget_amount !== null ? Math.round((Number(p.budget_amount) / budget) * 10000) / 100 : null,
    })),
  });
  if (error) return { error: error.message };

  refresh();
  return { error: null, ok: true, message: `Saved as "${name}".` };
}

// ---------------------------------------------------------------------
// Quick actions from the Projects sheet
// ---------------------------------------------------------------------

/** Add hours for one phase and day. Adds to anything you already logged that day. */
export async function quickLogHours(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const projectId = text(formData, "project_id");
  const phaseId = text(formData, "phase_id");
  const workDate = text(formData, "work_date");
  const hoursRaw = text(formData, "hours");
  const note = text(formData, "note");

  if (!projectId || !phaseId) return { error: "Pick a phase." };
  if (!workDate || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return { error: "Pick a date." };

  // Accept 2, 1.5, 2,5 or 1:30
  let hours = NaN;
  const hm = hoursRaw?.match(/^(\d{1,2}):(\d{1,2})$/);
  if (hm) hours = Number(hm[1]) + Number(hm[2]) / 60;
  else if (hoursRaw) hours = Number(hoursRaw.replace(",", "."));
  if (!Number.isFinite(hours) || hours <= 0) return { error: "Enter the hours worked, like 2, 1.5 or 1:30." };
  hours = Math.round(hours * 100) / 100;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { error: "You need to be logged in to log hours." };

  const [{ data: project }, { data: phase }, { data: existing }] = await Promise.all([
    supabase.from("projects").select("hourly_rate").eq("id", projectId).single(),
    supabase.from("phases").select("project_id, name").eq("id", phaseId).single(),
    supabase
      .from("time_entries")
      .select("id, hours, note")
      .eq("phase_id", phaseId)
      .eq("user_id", userId)
      .eq("work_date", workDate)
      .maybeSingle(),
  ]);
  if (!project || !phase || phase.project_id !== projectId) return { error: "That phase isn't part of this project." };

  const total = Math.round((Number(existing?.hours ?? 0) + hours) * 100) / 100;
  if (total > 24) {
    return { error: `That would make ${total} hours on one day for this phase. The most is 24.` };
  }

  const { error } = existing
    ? await supabase
        .from("time_entries")
        .update({ hours: total, note: [existing.note, note].filter(Boolean).join("\n") || null })
        .eq("id", existing.id)
    : await supabase.from("time_entries").insert({
        project_id: projectId,
        phase_id: phaseId,
        user_id: userId,
        work_date: workDate,
        hours,
        rate: Number(project.hourly_rate ?? 0),
        note,
      });
  if (error) return { error: error.message };

  refresh();
  return {
    error: null,
    ok: true,
    message: existing
      ? `Added ${hours} h to ${phase.name} (${total} h that day).`
      : `Logged ${hours} h on ${phase.name}.`,
  };
}

/** Mark a phase complete so the project moves on to its next phase. */
export async function completePhase(phaseId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("phases").update({ is_complete: true }).eq("id", phaseId);
  if (error) return { error: error.message };
  refresh();
  return { error: null, ok: true };
}
