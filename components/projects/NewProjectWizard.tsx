"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/app/projects/actions";
import { savePhaseSetList } from "@/app/phases/actions";
import type { PhaseSet, PhaseTag } from "@/lib/data";
import { forecast, type ProjectStats } from "@/lib/forecast";
import { addDays, daysBetween, shortDate } from "@/lib/dates";
import { PROJECT_COLORS, hoursText, money, pct } from "@/lib/options";
import { Field } from "@/components/ui/forms";
import VerdictDot from "@/components/ui/VerdictDot";

type Line = { key: number; name: string; share: number | null };

const STEPS = ["Project", "Phases", "Timeline & budget", "Forecast"];
const SEGMENT_COLORS = ["#c9a66b", "#8fb3c9", "#9ec9a0", "#c98f8f", "#b39ec9", "#c9c38f", "#8fc9c4", "#e4e4e4"];

// Larger inputs for this page: easier to hit with a mouse or a finger
const bigInput =
  "h-12 w-full border-b border-moa-line bg-moa-bg text-lg font-medium outline-none transition-colors focus:border-moa-text";

let keySeq = 0;
const nextKey = () => ++keySeq;

const parseNum = (v: string) => {
  const n = Number(v.replace(/[$,%\s]/g, ""));
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
};

export default function NewProjectWizard({
  tags,
  sets: initialSets,
  projectTypes,
  history,
  today,
  defaultRate,
}: {
  tags: PhaseTag[];
  sets: PhaseSet[];
  projectTypes: string[];
  history: ProjectStats[];
  today: string;
  defaultRate: number | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Step 1
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [type, setType] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[1]);

  // Step 2
  const [sets, setSets] = useState(initialSets);
  const [appliedSet, setAppliedSet] = useState<string | null>(null);
  const [phases, setPhases] = useState<Line[]>([]);

  // Step 3
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(addDays(today, 90));
  const [rate, setRate] = useState(defaultRate ? String(defaultRate) : "");
  const [budget, setBudget] = useState("");

  const rateN = parseNum(rate);
  const budgetN = parseNum(budget);
  const budgetHours = budgetN && rateN ? budgetN / rateN : null;
  const shareTotal = phases.reduce((s, p) => s + (p.share ?? 0), 0);
  const plannedDays = start && end && end >= start ? daysBetween(start, end) + 1 : null;
  const weeksPlanned = plannedDays ? plannedDays / 7 : null;

  const applySet = (s: PhaseSet) => {
    setPhases(s.items.map((i) => ({ key: nextKey(), name: i.name, share: i.budget_share })));
    setAppliedSet(s.id);
    if (!type && /adu/i.test(s.name)) setType("ADU");
  };

  const splitEvenly = () =>
    setPhases((list) =>
      list.map((p, i) => {
        // Whole percentages that always add up to exactly 100
        const base = Math.floor(100 / list.length);
        return { ...p, share: base + (i < 100 - base * list.length ? 1 : 0) };
      })
    );

  const setShare = (key: number, share: number | null) =>
    setPhases((list) =>
      list.map((p) => (p.key === key ? { ...p, share: share === null ? null : Math.max(0, Math.min(100, share)) } : p))
    );

  // ---------- Forecast preview ----------
  const preview = useMemo(
    () =>
      forecast(
        {
          id: null,
          projectType: type || null,
          budget: budgetN,
          startDate: start || null,
          plannedDays,
          amount: 0,
          usedPct: budgetN ? 0 : null,
          elapsedPct: null,
          phaseNames: phases.map((p) => p.name),
        },
        history
      ),
    [type, budgetN, start, plannedDays, phases, history]
  );

  // ---------- Navigation ----------
  function validate(s: number) {
    if (s === 0 && !name.trim()) return "Give the project a name.";
    if (s === 1 && phases.length === 0) return "Add at least one phase, so there's somewhere to log hours.";
    if (s === 1 && phases.some((p) => !p.name.trim())) return "Every phase needs a name.";
    if (s === 1 && new Set(phases.map((p) => p.name.trim().toLowerCase())).size !== phases.length)
      return "Two phases have the same name.";
    if (s === 2 && start && end && end < start) return "The planned finish is before the start date.";
    if (s === 2 && rate.trim() && rateN === null) return "The hourly rate must be a number.";
    if (s === 2 && budget.trim() && budgetN === null) return "The budget must be a number.";
    return null;
  }

  function goTo(target: number) {
    if (target > step) {
      for (let s = step; s < target; s++) {
        const problem = validate(s);
        if (problem) {
          setStep(s);
          setError(problem);
          return;
        }
      }
    }
    setError(null);
    setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function create() {
    for (let s = 0; s < 3; s++) {
      const problem = validate(s);
      if (problem) {
        setStep(s);
        setError(problem);
        return;
      }
    }
    setError(null);
    startTransition(async () => {
      const result = await createProject({
        name,
        client_name: client,
        project_type: type,
        start_date: start,
        end_date: end,
        hourly_rate: rateN,
        budget_amount: budgetN,
        color,
        phases: phases.map((p) => ({
          name: p.name,
          budget_amount: budgetN && p.share ? Math.round((budgetN * p.share) / 100) : null,
        })),
        save_set_name: "",
      });
      if (result.error) setError(result.error);
      else if (result.id) router.push(`/projects/${result.id}`);
    });
  }

  const isLast = step === STEPS.length - 1;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-8">
      {/* ---------- Pinned bar: Back, steps, Continue ---------- */}
      <div className="sticky top-0 z-30 -mx-4 border-b border-moa-line bg-moa-bg/95 px-4 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex items-center justify-between gap-4 py-3">
          {step === 0 ? (
            <Link href="/" className="flex h-11 items-center text-moa-muted hover:text-moa-text">
              Cancel
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              className="flex h-11 items-center border border-moa-line px-4 font-medium transition-colors hover:border-moa-text"
            >
              Back
            </button>
          )}

          <ol className="hidden flex-1 justify-center gap-1 md:flex">
            {STEPS.map((label, i) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={i === step ? "step" : undefined}
                  className={`flex h-11 items-center gap-2 px-3 transition-colors ${
                    i === step ? "text-moa-text underline underline-offset-8" : "text-moa-muted hover:text-moa-text"
                  }`}
                >
                  <span>{i + 1}</span>
                  {label}
                </button>
              </li>
            ))}
          </ol>
          <p className="flex-1 text-center text-sm text-moa-muted md:hidden">
            Step {step + 1} of {STEPS.length}: <span className="text-moa-text">{STEPS[step]}</span>
          </p>

          {isLast ? (
            <button
              type="button"
              onClick={create}
              disabled={pending}
              className="flex h-11 items-center border border-moa-text bg-moa-text px-5 font-semibold text-moa-bg transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              {pending ? "Creating…" : "Create project"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => goTo(step + 1)}
              className="flex h-11 items-center border border-moa-text px-5 font-semibold transition-colors hover:bg-moa-text hover:text-moa-bg"
            >
              Continue
            </button>
          )}
        </div>
      </div>

      {/* ---------- Title updates as you type ---------- */}
      <header className="pb-8 pt-10">
        <p className="text-sm text-moa-muted">New project</p>
        <h1 className="mt-1 flex items-center gap-4 break-words text-4xl font-medium sm:text-6xl">
          <span aria-hidden className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" style={{ background: color }} />
          <span className={name.trim() ? "" : "text-moa-muted/60"}>{name.trim() || "Untitled project"}</span>
        </h1>
        {(client.trim() || type.trim()) && (
          <p className="mt-3 flex flex-wrap gap-x-5 text-lg text-moa-muted">
            {client.trim() && <span>{client}</span>}
            {type.trim() && <span>{type}</span>}
          </p>
        )}
      </header>

      {error && (
        <p role="alert" className="mb-8 border border-red-400/40 px-4 py-3 text-red-300">
          {error}
        </p>
      )}

      {/* ---------- 1. Project ---------- */}
      {step === 0 && (
        <div className="flex max-w-3xl flex-col gap-10">
          <Field label="Project title">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && goTo(1)}
              autoFocus
              placeholder="Project A"
              className={`${bigInput} h-14 text-2xl`}
            />
          </Field>
          <div className="grid gap-10 sm:grid-cols-2">
            <Field label="Client" hint="Optional">
              <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Smith Family" className={bigInput} />
            </Field>
            <Field label="Project type" hint="Projects of the same type are compared in forecasts.">
              <input value={type} onChange={(e) => setType(e.target.value)} list="project-types" className={bigInput} />
              <datalist id="project-types">
                {projectTypes.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </Field>
          </div>
          <fieldset>
            <legend className="mb-3 text-sm text-moa-muted">Row color</legend>
            <div className="flex flex-wrap gap-3">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                  className={`h-11 w-11 border-2 p-1 ${color === c ? "border-moa-text" : "border-transparent"}`}
                >
                  <span className="block h-full w-full" style={{ background: c }} />
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {/* ---------- 2. Phases ---------- */}
      {step === 1 && (
        <div className="flex flex-col gap-14">
          <CreateSetPanel
            tags={tags}
            onSaved={(saved) => {
              setSets((list) => [saved, ...list.filter((s) => s.name.toLowerCase() !== saved.name.toLowerCase())]);
              applySet(saved);
            }}
          />

          {sets.length > 0 && (
            <section>
              <h2 className="text-2xl font-medium">Start from a phase set</h2>
              <p className="mb-5 mt-1 text-moa-muted">Fills this project&apos;s phases below. You can still edit them afterwards.</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sets.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => applySet(s)}
                    aria-pressed={appliedSet === s.id}
                    className={`border p-4 text-left transition-colors ${
                      appliedSet === s.id ? "border-moa-text" : "border-moa-line hover:border-moa-muted"
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-lg font-medium">{s.name}</span>
                      <span className="shrink-0 text-sm text-moa-muted">
                        {appliedSet === s.id ? "Applied" : `${s.items.length} phases`}
                      </span>
                    </span>
                    <span className="mt-2 block text-sm leading-relaxed text-moa-muted">
                      {s.items.map((i) => i.name).join(", ")}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-2xl font-medium">This project&apos;s phases</h2>
            <p className="mb-5 mt-1 text-moa-muted">Hours are logged against these. New names are added to your phase library.</p>
            <LineEditor
              lines={phases}
              setLines={(fn) => {
                setPhases(fn);
                setAppliedSet(null);
              }}
              tags={tags}
              emptyText="No phases yet. Pick a phase set above, or add phases here."
              listId="project-phase-library"
            />
          </section>
        </div>
      )}

      {/* ---------- 3. Timeline & budget ---------- */}
      {step === 2 && (
        <div className="flex flex-col gap-14">
          <div className="grid gap-10 sm:grid-cols-2">
            <Field label="Start date">
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={bigInput} />
            </Field>
            <Field label="Planned finish" hint={plannedDays ? `${Math.round(plannedDays / 7)} weeks` : undefined}>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={bigInput} />
            </Field>
            <Field label="Hourly rate ($)">
              <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" placeholder="150" className={bigInput} />
            </Field>
            <Field label="Budget ($)" hint={budgetHours !== null ? `${hoursText(Math.round(budgetHours))} at this rate` : undefined}>
              <input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" placeholder="30000" className={bigInput} />
            </Field>
          </div>

          <section>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-medium">Budget by phase</h2>
                <p className="mt-1 text-moa-muted">Drag a slider or type a percentage. Optional.</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPhases((list) => list.map((p) => ({ ...p, share: null })))}
                  className="h-11 px-3 text-moa-muted hover:text-moa-text"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={splitEvenly}
                  className="h-11 border border-moa-line px-4 font-medium transition-colors hover:border-moa-text"
                >
                  Split evenly
                </button>
              </div>
            </div>

            {/* Total: one bar made of each phase's share */}
            <div className="mt-6">
              <div className="flex h-3 w-full overflow-hidden bg-moa-line/60" aria-hidden>
                {phases.map((p, i) =>
                  p.share ? (
                    <span
                      key={p.key}
                      title={`${p.name}: ${p.share}%`}
                      style={{ width: `${Math.min(p.share, 100)}%`, background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                    />
                  ) : null
                )}
              </div>
              <p
                className={`mt-2 text-sm ${
                  shareTotal === 0 ? "text-moa-muted" : Math.abs(shareTotal - 100) <= 0.5 ? "text-moa-text" : "text-[#c9c38f]"
                }`}
              >
                {shareTotal === 0
                  ? "No phase budgets yet: the project will be tracked as a whole."
                  : Math.abs(shareTotal - 100) <= 0.5
                    ? `100% assigned${budgetN ? `: ${money(budgetN)}` : ""}`
                    : shareTotal < 100
                      ? `${Math.round((100 - shareTotal) * 10) / 10}% left to assign`
                      : `${Math.round((shareTotal - 100) * 10) / 10}% over: lower some shares`}
              </p>
            </div>

            <ul className="mt-6 border-t border-moa-line">
              {phases.map((p, i) => {
                const amount = budgetN && p.share ? (budgetN * p.share) / 100 : null;
                return (
                  <li key={p.key} className="border-b border-moa-line py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                      <span className="flex items-center gap-3 text-lg font-medium">
                        <span aria-hidden className="h-3 w-3 shrink-0" style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
                        {p.name}
                      </span>
                      <span className="text-moa-muted">
                        <span className="text-moa-text">{amount !== null ? money(amount) : "—"}</span>
                        {amount !== null && rateN ? <span className="ml-3">{hoursText(Math.round(amount / rateN))}</span> : null}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={p.share ?? 0}
                        onChange={(e) => setShare(p.key, Number(e.target.value))}
                        aria-label={`${p.name} share of budget`}
                        className="moa-range min-w-0 flex-1"
                        style={{ "--fill": `${Math.min(p.share ?? 0, 100)}%` } as React.CSSProperties}
                      />
                      <label className="flex shrink-0 items-center gap-1">
                        <input
                          value={p.share ?? ""}
                          onChange={(e) => setShare(p.key, parseNum(e.target.value))}
                          inputMode="decimal"
                          placeholder="0"
                          aria-label={`${p.name} share in percent`}
                          className="h-11 w-20 border border-moa-line bg-transparent px-2 text-right text-lg tabular-nums outline-none focus:border-moa-text"
                        />
                        <span className="text-moa-muted">%</span>
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}

      {/* ---------- 4. Forecast ---------- */}
      {step === 3 && (
        <div className="flex flex-col gap-12">
          <section className="grid gap-8 border-y border-moa-line py-8 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Phases" value={String(phases.length)} />
            <Stat label="Budget" value={money(budgetN)} sub={budgetHours !== null ? hoursText(Math.round(budgetHours)) : undefined} />
            <Stat
              label="Timeline"
              value={plannedDays ? `${Math.round(plannedDays / 7)} weeks` : "—"}
              sub={start && end ? `${shortDate(start)} – ${shortDate(end, true)}` : undefined}
            />
            <Stat
              label="Pace to stay on budget"
              value={budgetHours !== null && weeksPlanned ? `${(budgetHours / weeksPlanned).toFixed(1)} h/week` : "—"}
            />
          </section>

          <section className="max-w-3xl">
            <h2 className="mb-4 flex items-center gap-3 text-3xl font-medium">
              <VerdictDot verdict={preview.verdict} />
              {preview.headline}
            </h2>
            {preview.similarCount > 0 && preview.projectedAmount !== null && (
              <p className="mb-4 text-lg">
                Expect to finish near <strong className="font-semibold">{money(preview.projectedAmount)}</strong>
                {preview.projectedPct !== null && ` (${pct(preview.projectedPct)} of budget)`}
                {preview.projectedEnd && (
                  <>
                    {" "}around <strong className="font-semibold">{shortDate(preview.projectedEnd, true)}</strong>
                  </>
                )}
                .
              </p>
            )}
            <ul className="flex flex-col gap-2 text-lg text-moa-muted">
              {preview.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <p className="mt-6 text-moa-muted">
              Once you log hours, the forecast also follows this project&apos;s own pace and updates every week.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// "Create a phase set" builder
// ---------------------------------------------------------------------
function CreateSetPanel({ tags, onSaved }: { tags: PhaseTag[]; onSaved: (s: PhaseSet) => void }) {
  const [open, setOpen] = useState(false);
  const [setName, setSetName] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const names = lines.map((l) => l.name);
      const result = await savePhaseSetList(setName, names);
      if (result.error || !result.id) {
        setMessage({ error: true, text: result.error ?? "Couldn't save the set." });
        return;
      }
      onSaved({
        id: result.id,
        name: setName.trim(),
        items: names.map((n, i) => ({ phase_tag_id: `${result.id}-${i}`, name: n.trim(), sort_order: i + 1, budget_share: null })),
      });
      setMessage({ error: false, text: `${result.message} It's now applied to this project below.` });
      setLines([]);
      setSetName("");
      setOpen(false);
    });
  }

  return (
    <section className="border border-moa-line p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium">Create a phase set</h2>
          <p className="mt-1 text-moa-muted">Build a reusable list of phases, save it, and use it on this and future projects.</p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setMessage(null);
            }}
            className="h-11 border border-moa-text px-5 font-semibold transition-colors hover:bg-moa-text hover:text-moa-bg"
          >
            Create a phase set
          </button>
        )}
      </div>

      {message && (
        <p role="status" className={`mt-4 ${message.error ? "text-red-300" : "text-moa-muted"}`}>
          {message.text}
        </p>
      )}

      {open && (
        <div className="mt-8 flex flex-col gap-8">
          <Field label="Set name">
            <input value={setName} onChange={(e) => setSetName(e.target.value)} autoFocus placeholder="Residential remodel" className={bigInput} />
          </Field>

          <div>
            <p className="mb-3 text-sm text-moa-muted">Phases in this set, in order</p>
            <LineEditor
              lines={lines}
              setLines={setLines}
              tags={tags}
              emptyText="Add the first phase of the set below."
              listId="set-phase-library"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-moa-line pt-6">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="h-12 border border-moa-text bg-moa-text px-6 font-semibold text-moa-bg transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save phase set"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setMessage(null);
              }}
              className="h-12 px-3 text-moa-muted hover:text-moa-text"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------
// An ordered list of phase names with add / rename / reorder / remove
// ---------------------------------------------------------------------
function LineEditor({
  lines,
  setLines,
  tags,
  emptyText,
  listId,
}: {
  lines: Line[];
  setLines: (fn: (list: Line[]) => Line[]) => void;
  tags: PhaseTag[];
  emptyText: string;
  listId: string;
}) {
  const [draft, setDraft] = useState("");
  const has = (n: string) => lines.some((l) => l.name.trim().toLowerCase() === n.trim().toLowerCase());
  const add = (n: string) => {
    const clean = n.trim();
    if (!clean || has(clean)) return;
    setLines((list) => [...list, { key: nextKey(), name: clean, share: null }]);
  };
  const move = (i: number, d: -1 | 1) =>
    setLines((list) => {
      const j = i + d;
      if (j < 0 || j >= list.length) return list;
      const copy = [...list];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  const unused = tags.filter((t) => !has(t.name));
  const iconBtn = "flex h-11 w-11 items-center justify-center text-lg text-moa-muted hover:text-moa-text disabled:opacity-25";

  return (
    <div>
      {lines.length === 0 ? (
        <p className="border-y border-moa-line py-5 text-moa-muted">{emptyText}</p>
      ) : (
        <ol className="border-t border-moa-line">
          {lines.map((l, i) => (
            <li key={l.key} className="flex items-center gap-2 border-b border-moa-line">
              <span className="w-8 shrink-0 text-moa-muted">{i + 1}</span>
              <input
                value={l.name}
                onChange={(e) => setLines((list) => list.map((x) => (x.key === l.key ? { ...x, name: e.target.value } : x)))}
                aria-label={`Phase ${i + 1} name`}
                className="h-12 min-w-0 flex-1 bg-transparent text-lg font-medium outline-none focus:underline"
              />
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${l.name} up`} className={iconBtn}>
                ↑
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === lines.length - 1} aria-label={`Move ${l.name} down`} className={iconBtn}>
                ↓
              </button>
              <button
                type="button"
                onClick={() => setLines((list) => list.filter((x) => x.key !== l.key))}
                aria-label={`Remove ${l.name}`}
                className="flex h-11 items-center px-2 text-sm text-moa-muted hover:text-moa-text"
              >
                Remove
              </button>
            </li>
          ))}
        </ol>
      )}

      <form
        className="mt-5 flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          add(draft);
          setDraft("");
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          list={listId}
          placeholder={`Phase ${lines.length + 1} name`}
          aria-label="New phase name"
          className={bigInput}
        />
        <datalist id={listId}>
          {unused.map((t) => (
            <option key={t.id} value={t.name} />
          ))}
        </datalist>
        <button type="submit" className="h-12 shrink-0 border border-moa-text px-5 font-semibold transition-colors hover:bg-moa-text hover:text-moa-bg">
          Add
        </button>
      </form>

      {unused.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-sm text-moa-muted">From your phase library</p>
          <div className="flex flex-wrap gap-2">
            {unused.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => add(t.name)}
                className="h-10 border border-moa-line px-3 transition-colors hover:border-moa-text"
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-sm text-moa-muted">{label}</p>
      <p className="mt-1 text-3xl font-medium">{value}</p>
      {sub && <p className="text-moa-muted">{sub}</p>}
    </div>
  );
}
