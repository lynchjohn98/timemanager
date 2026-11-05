"use client";

import { useState, useTransition } from "react";
import { addPhase, applyPhaseSet, deletePhase, movePhase, savePhasesAsSet, updatePhase } from "@/app/projects/actions";
import type { Phase, PhaseSet, PhaseTag } from "@/lib/data";
import { hoursText, money, pct } from "@/lib/options";
import { Field, FormMessage, SubmitButton, inputClass, useFormAction } from "@/components/ui/forms";

type EditablePhase = Phase & { hours: number; amount: number };

export default function PhaseEditor({
  projectId,
  phases,
  projectBudget,
  hourlyRate,
  tags,
  sets,
}: {
  projectId: string;
  phases: EditablePhase[];
  projectBudget: number | null;
  hourlyRate: number;
  tags: PhaseTag[];
  sets: PhaseSet[];
}) {
  const allocated = phases.reduce((s, p) => s + (p.budget_amount ?? 0), 0);
  const unusedTags = tags.filter((t) => !phases.some((p) => p.name.toLowerCase() === t.name.toLowerCase()));

  return (
    <div className="flex flex-col gap-12">
      {/* Phase list */}
      <section>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-2xl font-medium">Phases</h2>
          {projectBudget !== null && (
            <p className={`text-sm ${allocated > projectBudget ? "text-[#c9c38f]" : "text-moa-muted"}`}>
              {money(allocated)} of {money(projectBudget)} budget given to phases
            </p>
          )}
        </div>

        {phases.length === 0 ? (
          <p className="border-y border-moa-line py-6 text-moa-muted">No phases yet. Add one below or apply a phase set.</p>
        ) : (
          <div className="border-t border-moa-line">
            <div className="hidden grid-cols-[2rem_1fr_9rem_5.5rem_10rem_8rem] gap-4 border-b border-moa-line py-2 text-sm text-moa-muted md:grid">
              <span />
              <span>Name</span>
              <span>Budget ($)</span>
              <span>Complete</span>
              <span className="text-right">Logged</span>
              <span />
            </div>
            {phases.map((p, i) => (
              <PhaseRow
                key={`${p.id}-${p.name}-${p.budget_amount}-${p.is_complete}`}
                projectId={projectId}
                phase={p}
                index={i}
                count={phases.length}
                hourlyRate={hourlyRate}
              />
            ))}
          </div>
        )}
      </section>

      {/* Add */}
      <AddPhaseForm projectId={projectId} tagNames={unusedTags.map((t) => t.name)} nextNumber={phases.length + 1} />

      {/* Sets */}
      <section className="grid gap-10 border-t border-moa-line pt-10 md:grid-cols-2">
        <ApplySet projectId={projectId} sets={sets} />
        <SaveAsSet projectId={projectId} disabled={phases.length === 0} />
      </section>
    </div>
  );
}

function PhaseRow({
  projectId,
  phase,
  index,
  count,
  hourlyRate,
}: {
  projectId: string;
  phase: EditablePhase;
  index: number;
  count: number;
  hourlyRate: number;
}) {
  const { state, pending, onSubmit } = useFormAction(updatePhase);
  const [changed, setChanged] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  // Hide the Save button again once a save succeeds
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.ok) setChanged(false);
  }

  const used = phase.budget_amount ? phase.amount / phase.budget_amount : null;

  return (
    <div className="border-b border-moa-line/60 py-3">
      <form
        onSubmit={onSubmit}
        onChange={() => setChanged(true)}
        className="grid grid-cols-[2rem_1fr] items-center gap-x-4 gap-y-3 md:grid-cols-[2rem_1fr_9rem_5.5rem_10rem_8rem]"
      >
        <input type="hidden" name="id" value={phase.id} />
        <span className="text-moa-muted">{index + 1}</span>
        <input name="name" defaultValue={phase.name} required aria-label="Phase name" className={`${inputClass} font-medium`} />
        <input
          name="budget_amount"
          defaultValue={phase.budget_amount ?? ""}
          inputMode="decimal"
          placeholder="Budget"
          aria-label="Phase budget in dollars"
          className={`${inputClass} col-start-2 md:col-start-auto`}
        />
        <label className="col-start-2 flex items-center gap-2 text-sm md:col-start-auto">
          <input type="checkbox" name="is_complete" defaultChecked={phase.is_complete} className="h-4 w-4 accent-[#e4e4e4]" />
          <span className="md:sr-only">Complete</span>
        </label>
        <span className="col-start-2 text-sm md:col-start-auto md:text-right">
          {money(phase.amount)} <span className="text-moa-muted">{hoursText(phase.hours)}</span>
          {used !== null && <span className={`block text-xs ${used > 1 ? "text-[#c98f8f]" : "text-moa-muted"}`}>{pct(used)} of phase budget</span>}
          {used === null && phase.budget_amount === null && hourlyRate > 0 && <span className="block text-xs text-moa-muted">No phase budget</span>}
        </span>
        <div className="col-start-2 flex items-center gap-3 text-sm md:col-start-auto md:justify-end">
          {changed ? (
            <SubmitButton pending={pending} className="px-3 py-1.5 text-sm">
              Save
            </SubmitButton>
          ) : (
            <>
              <button
                type="button"
                disabled={index === 0 || busy}
                onClick={() => startTransition(() => movePhase(projectId, phase.id, "up"))}
                aria-label={`Move ${phase.name} up`}
                className="px-1 text-moa-muted hover:text-moa-text disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === count - 1 || busy}
                onClick={() => startTransition(() => movePhase(projectId, phase.id, "down"))}
                aria-label={`Move ${phase.name} down`}
                className="px-1 text-moa-muted hover:text-moa-text disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!confirm(`Delete the phase "${phase.name}"?`)) return;
                  startTransition(async () => {
                    const r = await deletePhase(phase.id);
                    setDeleteError(r.error);
                  });
                }}
                className="pl-1 text-moa-muted hover:text-moa-text"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </form>
      {(state.error || deleteError) && (
        <div className="mt-2 pl-12">
          <FormMessage state={{ error: state.error ?? deleteError }} />
        </div>
      )}
    </div>
  );
}

function AddPhaseForm({ projectId, tagNames, nextNumber }: { projectId: string; tagNames: string[]; nextNumber: number }) {
  const { state, pending, onSubmit } = useFormAction(addPhase);
  const [formKey, setFormKey] = useState(0);
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.ok) setFormKey((k) => k + 1);
  }

  return (
    <section>
      <h3 className="mb-4 text-xl font-medium">Add a phase</h3>
      <form key={formKey} onSubmit={onSubmit} className="grid items-end gap-6 sm:grid-cols-[1fr_10rem_auto]">
        <input type="hidden" name="project_id" value={projectId} />
        <Field label="Name" hint="Pick from your phase library or type a new name.">
          <input name="name" required list="library-phases" placeholder={`Phase ${nextNumber}`} className={inputClass} />
          <datalist id="library-phases">
            {tagNames.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        <Field label="Budget ($)" hint="Optional">
          <input name="budget_amount" inputMode="decimal" className={inputClass} />
        </Field>
        <SubmitButton pending={pending} pendingText="Adding…" className="mb-5">
          Add phase
        </SubmitButton>
      </form>
      <FormMessage state={state} />
    </section>
  );
}

function ApplySet({ projectId, sets }: { projectId: string; sets: PhaseSet[] }) {
  const [setId, setSetId] = useState(sets[0]?.id ?? "");
  const [message, setMessage] = useState<{ error: string | null; message?: string | null }>({ error: null });
  const [pending, startTransition] = useTransition();
  const chosen = sets.find((s) => s.id === setId);

  if (sets.length === 0) {
    return (
      <div>
        <h3 className="mb-2 text-xl font-medium">Apply a phase set</h3>
        <p className="text-moa-muted">You don&apos;t have any saved phase sets yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-2 text-xl font-medium">Apply a phase set</h3>
      <p className="mb-4 text-sm text-moa-muted">Adds the set&apos;s phases this project doesn&apos;t have yet, with their share of the budget.</p>
      <div className="flex items-end gap-4">
        <Field label="Set" className="flex-1">
          <select value={setId} onChange={(e) => setSetId(e.target.value)} className={inputClass}>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="button"
          disabled={pending || !setId}
          onClick={() => startTransition(async () => setMessage(await applyPhaseSet(projectId, setId)))}
          className="border border-moa-text px-5 py-2.5 font-semibold transition-colors hover:bg-moa-text hover:text-moa-bg disabled:opacity-50"
        >
          {pending ? "Adding…" : "Apply"}
        </button>
      </div>
      {chosen && <p className="mt-3 text-sm text-moa-muted">{chosen.items.map((i) => i.name).join(", ")}</p>}
      <div className="mt-3">
        <FormMessage state={message} />
      </div>
    </div>
  );
}

function SaveAsSet({ projectId, disabled }: { projectId: string; disabled: boolean }) {
  const { state, pending, onSubmit } = useFormAction(savePhasesAsSet);
  return (
    <div>
      <h3 className="mb-2 text-xl font-medium">Save as a phase set</h3>
      <p className="mb-4 text-sm text-moa-muted">Reuse this project&apos;s phases and budget split on future projects.</p>
      <form onSubmit={onSubmit} className="flex items-end gap-4">
        <input type="hidden" name="project_id" value={projectId} />
        <Field label="Set name" className="flex-1">
          <input name="name" required disabled={disabled} className={inputClass} />
        </Field>
        <SubmitButton pending={pending} className={disabled ? "pointer-events-none opacity-40" : ""}>
          Save set
        </SubmitButton>
      </form>
      <div className="mt-3">
        <FormMessage state={state} />
      </div>
    </div>
  );
}
