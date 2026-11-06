"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { completePhase, quickLogHours } from "@/app/projects/actions";
import Modal from "@/components/ui/Modal";
import { Field, FormMessage, SubmitButton, inputClass, useFormAction } from "@/components/ui/forms";

type PhaseOption = { id: string; name: string; is_complete: boolean };

/** "Log hours" and "Next phase" buttons for one row of the Projects sheet. */
export default function QuickLog({
  projectId,
  projectName,
  phases,
  currentPhaseId,
  currentPhase,
  nextPhase,
  today,
  canAdvance,
}: {
  projectId: string;
  projectName: string;
  phases: PhaseOption[];
  currentPhaseId: string | null;
  currentPhase: string | null;
  nextPhase: string | null;
  today: string;
  canAdvance: boolean; // only project admins move phases on
}) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (phases.length === 0) return null;

  function advance() {
    if (!currentPhaseId || !currentPhase) return;
    const question = nextPhase
      ? `Mark "${currentPhase}" complete and move ${projectName} to "${nextPhase}"?`
      : `Mark "${currentPhase}" complete? It's the last unfinished phase of ${projectName}.`;
    if (!confirm(question)) return;
    startTransition(async () => {
      const r = await completePhase(currentPhaseId);
      setNotice(r.error ?? (nextPhase ? `Moved to ${nextPhase}.` : "All phases complete."));
    });
  }

  const btn =
    "h-8 border border-moa-line px-2.5 text-xs font-medium text-moa-text transition-colors hover:border-moa-text disabled:opacity-40";

  return (
    <>
      <div className="mt-2 flex items-center gap-2 whitespace-nowrap">
        <button type="button" onClick={() => setOpen(true)} className={btn}>
          Log hours
        </button>
        {canAdvance && currentPhaseId && (
          <button
            type="button"
            onClick={advance}
            disabled={pending}
            className={btn}
            title={nextPhase ? `Mark ${currentPhase} complete and move to ${nextPhase}` : `Mark ${currentPhase} complete`}
          >
            {pending ? "Moving…" : nextPhase ? "Next phase" : "Finish phase"}
          </button>
        )}
      </div>
      {notice && (
        <p role="status" className="mt-1 text-xs text-moa-muted">
          {notice}
        </p>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Log hours">
        <QuickLogForm
          projectId={projectId}
          projectName={projectName}
          phases={phases}
          defaultPhaseId={currentPhaseId ?? phases.find((p) => !p.is_complete)?.id ?? phases[0].id}
          today={today}
          onDone={(message) => {
            setOpen(false);
            setNotice(message);
          }}
        />
      </Modal>
    </>
  );
}

function QuickLogForm({
  projectId,
  projectName,
  phases,
  defaultPhaseId,
  today,
  onDone,
}: {
  projectId: string;
  projectName: string;
  phases: PhaseOption[];
  defaultPhaseId: string;
  today: string;
  onDone: (message: string) => void;
}) {
  const { state, pending, onSubmit } = useFormAction(quickLogHours);
  const [hours, setHours] = useState("");
  const hoursRef = useRef<HTMLInputElement>(null);

  // Close once saved
  useEffect(() => {
    if (state.ok) onDone(state.message ?? "Hours logged.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <input type="hidden" name="project_id" value={projectId} />
      <p className="-mt-3 text-lg text-moa-muted">{projectName}</p>

      <Field label="Phase">
        <select name="phase_id" defaultValue={defaultPhaseId} className={`${inputClass} h-12 text-lg`}>
          {phases.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.is_complete ? " (complete)" : ""}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Date">
          <input type="date" name="work_date" defaultValue={today} max="2100-12-31" required className={`${inputClass} h-12 text-lg`} />
        </Field>
        <Field label="Hours" hint="2, 1.5 or 1:30">
          <input
            ref={hoursRef}
            name="hours"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            inputMode="decimal"
            autoFocus
            required
            placeholder="0"
            className={`${inputClass} h-12 text-2xl tabular-nums`}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Quick amounts">
        {["0.5", "1", "2", "4", "8"].map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => {
              setHours(h);
              hoursRef.current?.focus();
            }}
            aria-pressed={hours === h}
            className={`h-11 min-w-14 border px-3 tabular-nums transition-colors ${
              hours === h ? "border-moa-text" : "border-moa-line text-moa-muted hover:text-moa-text"
            }`}
          >
            {h} h
          </button>
        ))}
      </div>

      <Field label="Note" hint="Optional">
        <input name="note" className={inputClass} placeholder="What you worked on" />
      </Field>

      <FormMessage state={state.ok ? { error: null } : state} />
      <SubmitButton pending={pending} pendingText="Logging…" className="h-12 text-lg">
        Log hours
      </SubmitButton>
    </form>
  );
}
