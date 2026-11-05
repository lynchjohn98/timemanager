"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/options";

const refresh = () => revalidatePath("/", "layout");

export async function addPhaseTag(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Enter a phase name." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("ensure_phase_tag", { p_name: name });
  if (error) return { error: error.message };
  refresh();
  return { error: null, ok: true, message: `"${name}" is in the library.` };
}

export async function renamePhaseTag(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "A phase needs a name." };

  const supabase = await createClient();
  const { error } = await supabase.from("phase_tags").update({ name }).eq("id", id);
  if (error) {
    return { error: error.code === "23505" ? `"${name}" is already in the library.` : error.message };
  }
  refresh();
  return { error: null, ok: true, message: "Renamed." };
}

/** Removing a phase from the library doesn't touch projects that already use it. */
export async function deletePhaseTag(id: string) {
  const supabase = await createClient();
  await supabase.from("phase_tags").delete().eq("id", id);
  refresh();
}

export async function createPhaseSet(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const phases = formData.getAll("phase").map(String).filter(Boolean);
  if (!name) return { error: "Name the phase set." };
  if (phases.length === 0) return { error: "Pick at least one phase." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_phase_set", {
    p_name: name,
    p_phases: phases.map((p) => ({ name: p })),
  });
  if (error) return { error: error.message };
  refresh();
  return { error: null, ok: true, message: `Saved "${name}".` };
}

export async function deletePhaseSet(id: string) {
  const supabase = await createClient();
  await supabase.from("phase_sets").delete().eq("id", id);
  refresh();
}

/** Save a list of phase names as a set (used by the "Create a phase set" builder). */
export async function savePhaseSetList(name: string, phases: string[]): Promise<ActionState> {
  const cleanName = name.trim();
  const names = phases.map((p) => p.trim()).filter(Boolean);
  if (!cleanName) return { error: "Name the phase set." };
  if (names.length === 0) return { error: "Add at least one phase to the set." };
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) return { error: "Two phases in the set have the same name." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_phase_set", {
    p_name: cleanName,
    p_phases: names.map((n) => ({ name: n })),
  });
  if (error) return { error: error.message };
  refresh();
  return { error: null, ok: true, id: data as string, message: `Saved "${cleanName}" to your phase sets.` };
}
