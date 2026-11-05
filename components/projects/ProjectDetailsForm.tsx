"use client";

import { useState } from "react";
import { deleteProject, updateProject } from "@/app/projects/actions";
import type { Project } from "@/lib/data";
import { PROJECT_COLORS, PROJECT_STATUSES } from "@/lib/options";
import { Field, FormMessage, SubmitButton, inputClass, useFormAction } from "@/components/ui/forms";

export default function ProjectDetailsForm({ project: p, projectTypes }: { project: Project; projectTypes: string[] }) {
  const { state, pending, onSubmit } = useFormAction(updateProject);
  const [color, setColor] = useState(p.color ?? "");

  return (
    <div className="flex max-w-2xl flex-col gap-12">
      <form onSubmit={onSubmit} className="flex flex-col gap-7">
        <input type="hidden" name="id" value={p.id} />
        <input type="hidden" name="color" value={color} />

        <Field label="Project title">
          <input name="name" required defaultValue={p.name} className={`${inputClass} text-xl`} />
        </Field>

        <div className="grid gap-7 sm:grid-cols-2">
          <Field label="Client">
            <input name="client_name" defaultValue={p.client_name ?? ""} className={inputClass} />
          </Field>
          <Field label="Project type">
            <input name="project_type" defaultValue={p.project_type ?? ""} list="detail-types" className={inputClass} />
            <datalist id="detail-types">
              {projectTypes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label="Status" hint="Completed projects are used to forecast new ones.">
            <select name="status" defaultValue={p.status} className={inputClass}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <div />
          <Field label="Start date">
            <input type="date" name="start_date" defaultValue={p.start_date ?? ""} className={inputClass} />
          </Field>
          <Field label="Planned finish">
            <input type="date" name="end_date" defaultValue={p.end_date ?? ""} className={inputClass} />
          </Field>
          <Field label="Hourly rate ($)" hint="New hours use this rate. Hours already saved keep theirs.">
            <input name="hourly_rate" defaultValue={p.hourly_rate || ""} inputMode="decimal" className={inputClass} />
          </Field>
          <Field label="Budget ($)">
            <input name="budget_amount" defaultValue={p.budget_amount ?? ""} inputMode="decimal" className={inputClass} />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-3 text-sm text-moa-muted">Row color</legend>
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                className={`h-8 w-8 border-2 ${color === c ? "border-moa-text" : "border-transparent"}`}
              >
                <span className="block h-full w-full" style={{ background: c }} />
              </button>
            ))}
          </div>
        </fieldset>

        <Field label="Notes">
          <textarea name="notes" rows={3} defaultValue={p.notes ?? ""} className={`${inputClass} resize-y`} />
        </Field>

        <div className="flex items-center gap-4">
          <SubmitButton pending={pending}>Save details</SubmitButton>
          <FormMessage state={state} />
        </div>
      </form>

      <form
        action={deleteProject.bind(null, p.id)}
        onSubmit={(e) => {
          if (!confirm(`Delete "${p.name}"? Its phases and all hours logged on it are deleted too.`)) e.preventDefault();
        }}
        className="border-t border-moa-line pt-8"
      >
        <button type="submit" className="text-sm text-red-300 hover:text-red-200">
          Delete this project
        </button>
      </form>
    </div>
  );
}
