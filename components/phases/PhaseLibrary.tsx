"use client";

import { useState } from "react";
import { addPhaseTag, createPhaseSet, deletePhaseSet, deletePhaseTag, renamePhaseTag } from "@/app/phases/actions";
import type { PhaseSet, PhaseTag } from "@/lib/data";
import { Field, FormMessage, SubmitButton, inputClass, useFormAction } from "@/components/ui/forms";

export default function PhaseLibrary({ tags, sets }: { tags: PhaseTag[]; sets: PhaseSet[] }) {
  return (
    <div className="mt-12 grid gap-14 lg:grid-cols-2">
      <section>
        <h2 className="mb-4 text-2xl font-medium">Phases</h2>
        <ul className="border-t border-moa-line">
          {tags.map((t) => (
            <TagRow key={`${t.id}-${t.name}`} tag={t} />
          ))}
        </ul>
        {tags.length === 0 && <p className="py-4 text-moa-muted">No phases saved yet.</p>}
        <AddTag />
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-medium">Phase sets</h2>
        <ul className="border-t border-moa-line">
          {sets.map((s) => (
            <li key={s.id} className="border-b border-moa-line py-4">
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-medium">{s.name}</p>
                <form
                  action={deletePhaseSet.bind(null, s.id)}
                  onSubmit={(e) => {
                    if (!confirm(`Delete the phase set "${s.name}"? Projects that used it keep their phases.`)) e.preventDefault();
                  }}
                >
                  <button type="submit" className="text-sm text-moa-muted hover:text-moa-text">
                    Delete
                  </button>
                </form>
              </div>
              <ol className="mt-2 text-sm text-moa-muted">
                {s.items.map((i, n) => (
                  <li key={i.phase_tag_id}>
                    {n + 1}. {i.name}
                    {i.budget_share !== null && <span className="ml-2">{i.budget_share}%</span>}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
        {sets.length === 0 && <p className="py-4 text-moa-muted">No phase sets saved yet.</p>}
        <NewSet tags={tags} />
      </section>
    </div>
  );
}

function TagRow({ tag }: { tag: PhaseTag }) {
  const { state, pending, onSubmit } = useFormAction(renamePhaseTag);
  const [changed, setChanged] = useState(false);
  return (
    <li className="border-b border-moa-line py-2">
      <div className="flex items-center gap-4">
        <form onSubmit={onSubmit} onChange={() => setChanged(true)} className="flex min-w-0 flex-1 items-center gap-4">
          <input type="hidden" name="id" value={tag.id} />
          <input
            name="name"
            defaultValue={tag.name}
            required
            aria-label="Phase name"
            className="min-w-0 flex-1 bg-transparent py-1 font-medium outline-none focus:underline"
          />
          {changed && (
            <SubmitButton pending={pending} className="px-3 py-1 text-sm">
              Save
            </SubmitButton>
          )}
        </form>
        {!changed && (
          <form
            action={deletePhaseTag.bind(null, tag.id)}
            onSubmit={(e) => {
              if (!confirm(`Remove "${tag.name}" from the library? Projects using it keep the phase.`)) e.preventDefault();
            }}
          >
            <button type="submit" className="text-sm text-moa-muted hover:text-moa-text">
              Remove
            </button>
          </form>
        )}
      </div>
      {state.error && <FormMessage state={state} />}
    </li>
  );
}

function AddTag() {
  const { state, pending, onSubmit } = useFormAction(addPhaseTag);
  const [key, setKey] = useState(0);
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.ok) setKey((k) => k + 1);
  }
  return (
    <form key={key} onSubmit={onSubmit} className="mt-6 flex items-end gap-4">
      <Field label="New phase" className="flex-1">
        <input name="name" required className={inputClass} />
      </Field>
      <SubmitButton pending={pending} pendingText="Adding…">
        Add
      </SubmitButton>
      <span className="sr-only" role="status">{state.message}</span>
    </form>
  );
}

function NewSet({ tags }: { tags: PhaseTag[] }) {
  const { state, pending, onSubmit } = useFormAction(createPhaseSet);
  const [picked, setPicked] = useState<string[]>([]);
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.ok) setPicked([]);
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
      <h3 className="text-xl font-medium">New phase set</h3>
      <Field label="Set name">
        <input name="name" required className={inputClass} placeholder="Commercial fit-out" />
      </Field>
      <div>
        <p className="mb-2 text-sm text-moa-muted">Click phases in the order they happen</p>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => {
            const n = picked.indexOf(t.name);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setPicked((p) => (n >= 0 ? p.filter((x) => x !== t.name) : [...p, t.name]))}
                aria-pressed={n >= 0}
                className={`border px-3 py-1 text-sm transition-colors ${n >= 0 ? "border-moa-text" : "border-moa-line text-moa-muted hover:text-moa-text"}`}
              >
                {n >= 0 && <span className="mr-1.5">{n + 1}</span>}
                {t.name}
              </button>
            );
          })}
        </div>
        {picked.map((p) => (
          <input key={p} type="hidden" name="phase" value={p} />
        ))}
      </div>
      <div className="flex items-center gap-4">
        <SubmitButton pending={pending}>Save set</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
