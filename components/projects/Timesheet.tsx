"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveWeek } from "@/app/projects/actions";
import type { TimeCell } from "@/lib/data";
import { addDays, formatDay, shortDate, toDayNumber } from "@/lib/dates";
import { hoursText } from "@/lib/options";

type Row = { id: string; name: string; is_complete: boolean; totalHours: number };
type Cell = { hours: number; note: string };
type Editing = { phase: Row; date: string; top: number; left: number; startWith?: string };

const cellKey = (phaseId: string, date: string) => `${phaseId}|${date}`;

/** Accepts "2", "2.5", "2,5" or "2:30" (hours:minutes). Empty = 0. */
function parseHours(raw: string): number | null {
  const v = raw.trim();
  if (!v) return 0;
  const hm = v.match(/^(\d{1,2}):(\d{1,2})$/);
  if (hm) return Number(hm[1]) + Number(hm[2]) / 60;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const show = (n: number) => (n ? String(Math.round(n * 100) / 100) : "");

export default function Timesheet({
  projectId,
  weekStart,
  today,
  phases,
  initialCells,
  team,
}: {
  projectId: string;
  weekStart: string;
  today: string;
  phases: Row[];
  initialCells: TimeCell[];
  team: { name: string; hours: number }[];
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const [cells, setCells] = useState<Record<string, Cell>>(() =>
    Object.fromEntries(initialCells.map((c) => [cellKey(c.phase_id, c.work_date), { hours: c.hours, note: c.note ?? "" }]))
  );
  const [editing, setEditing] = useState<Editing | null>(null);
  const [status, setStatus] = useState<{ error: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const hoursAt = (k: string) => cells[k]?.hours ?? 0;
  const rowTotal = (phaseId: string) => days.reduce((s, d) => s + hoursAt(cellKey(phaseId, d)), 0);
  const dayTotal = (d: string) => phases.reduce((s, p) => s + hoursAt(cellKey(p.id, d)), 0);
  const weekTotal = days.reduce((s, d) => s + dayTotal(d), 0);

  /** Open the box under a cell (or as a sheet at the bottom on phones). */
  function open(phase: Row, date: string, target: HTMLElement, startWith?: string) {
    const r = target.getBoundingClientRect();
    const width = 320;
    setStatus(null);
    setEditing({
      phase,
      date,
      top: r.bottom + 8,
      left: Math.min(Math.max(12, r.left + r.width / 2 - width / 2), window.innerWidth - width - 12),
      startWith,
    });
  }

  /** Save one day's hours and note (the rest of the week is sent unchanged). */
  function saveCell(phaseId: string, date: string, next: Cell) {
    const updated = { ...cells, [cellKey(phaseId, date)]: next };
    const payload: TimeCell[] = [];
    for (const p of phases)
      for (const d of days) {
        const c = updated[cellKey(p.id, d)];
        if (c && c.hours > 0) payload.push({ phase_id: p.id, work_date: d, hours: c.hours, note: c.note || null });
      }

    startTransition(async () => {
      const result = await saveWeek(projectId, weekStart, payload);
      if (result.error) {
        setStatus({ error: true, text: result.error });
        return;
      }
      setCells(updated);
      setEditing(null);
      const name = phases.find((p) => p.id === phaseId)?.name ?? "";
      setStatus({
        error: false,
        text: next.hours > 0 ? `Saved ${show(next.hours)} h on ${name}, ${shortDate(date)}.` : `Cleared ${name}, ${shortDate(date)}.`,
      });
    });
  }

  const weekHref = (d: string) => `/projects/${projectId}?week=${d}`;
  const isThisWeek = today >= weekStart && today <= addDays(weekStart, 6);

  if (phases.length === 0) {
    return (
      <p className="border-y border-moa-line py-6 text-moa-muted">
        This project has no phases yet, so there&apos;s nowhere to log hours. A project admin can add phases.
      </p>
    );
  }

  return (
    <div>
      {/* Week navigation */}
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="text-2xl font-medium">
          Week of {shortDate(weekStart)} – {shortDate(addDays(weekStart, 6), true)}
        </h2>
        <div className="flex items-center gap-5 text-sm font-medium text-moa-muted">
          <Link href={weekHref(addDays(weekStart, -7))} scroll={false} className="hover:text-moa-text">
            Previous week
          </Link>
          {!isThisWeek && (
            <Link href={`/projects/${projectId}`} scroll={false} className="hover:text-moa-text">
              This week
            </Link>
          )}
          <Link href={weekHref(addDays(weekStart, 7))} scroll={false} className="hover:text-moa-text">
            Next week
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="border-b border-moa-line text-sm text-moa-muted">
              <th className="py-3 pr-4 text-left font-normal">Your hours by phase</th>
              {days.map((d) => {
                const isToday = d === today;
                return (
                  <th key={d} className={`w-20 px-1 py-3 text-center font-normal ${isToday ? "text-moa-text" : ""}`}>
                    <span className="block">{formatDay(toDayNumber(d), { weekday: "short" })}</span>
                    <span className={`block text-xs ${isToday ? "underline underline-offset-4" : ""}`}>{shortDate(d)}</span>
                  </th>
                );
              })}
              <th className="w-20 py-3 pl-3 text-right font-normal">Week</th>
            </tr>
          </thead>
          <tbody>
            {phases.map((p, i) => (
              <tr key={p.id} className="border-b border-moa-line/60">
                <td className="py-2 pr-4">
                  <span className={`block ${p.is_complete ? "text-moa-muted line-through" : "font-medium"}`}>
                    <span className="mr-3 text-moa-muted">{i + 1}</span>
                    {p.name}
                  </span>
                  <span className="ml-7 text-xs text-moa-muted">{hoursText(p.totalHours)} all time</span>
                </td>
                {days.map((d, di) => {
                  const k = cellKey(p.id, d);
                  const c = cells[k];
                  const isOpen = editing?.phase.id === p.id && editing.date === d;
                  return (
                    <td key={d} className={`px-1 py-2 ${di >= 5 ? "bg-white/[0.02]" : ""}`}>
                      <button
                        type="button"
                        onClick={(e) => open(p, d, e.currentTarget)}
                        onKeyDown={(e) => {
                          // Start typing a number to open the box with it filled in
                          if (/^[0-9.,:]$/.test(e.key)) {
                            e.preventDefault();
                            open(p, d, e.currentTarget, e.key);
                          }
                        }}
                        aria-label={`${p.name}, ${shortDate(d)}: ${c?.hours ? `${show(c.hours)} hours` : "no hours"}${c?.note ? ", has a note" : ""}`}
                        aria-haspopup="dialog"
                        aria-expanded={isOpen}
                        title={c?.note || undefined}
                        className={`relative flex h-10 w-full items-center justify-center border tabular-nums transition-colors hover:border-moa-text focus-visible:border-moa-text focus-visible:outline-none ${
                          isOpen ? "border-moa-text" : "border-moa-line/60"
                        } ${c?.hours ? "text-moa-text" : "text-moa-line"}`}
                      >
                        {c?.hours ? show(c.hours) : "–"}
                        {c?.note && <span aria-hidden className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#c9a66b]" />}
                      </button>
                    </td>
                  );
                })}
                <td className="py-2 pl-3 text-right tabular-nums">{show(rowTotal(p.id)) || <span className="text-moa-muted">0</span>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-sm">
              <td className="py-3 pr-4 text-moa-muted">Day total</td>
              {days.map((d) => (
                <td key={d} className="px-1 py-3 text-center tabular-nums text-moa-muted">
                  {show(dayTotal(d))}
                </td>
              ))}
              <td className="py-3 pl-3 text-right text-base font-semibold tabular-nums">{show(weekTotal) || "0"} h</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
        <span className="text-moa-muted">Click a day to add hours and a note. Each day saves on its own.</span>
        <span className="flex items-center gap-2 text-moa-muted">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#c9a66b]" /> has a note
        </span>
        {status && !editing && (
          <span role="status" className={status.error ? "text-red-300" : "text-moa-text"}>
            {status.text}
          </span>
        )}
      </div>

      {team.length > 0 && (
        <p className="mt-8 border-t border-moa-line pt-4 text-sm text-moa-muted">
          Logged on this project this week:{" "}
          {team.map((t, i) => (
            <span key={t.name + i}>
              {i > 0 && ", "}
              <span className="text-moa-text">{t.name}</span> {hoursText(t.hours)}
            </span>
          ))}
        </p>
      )}

      {editing && (
        <CellEditor
          key={`${editing.phase.id}|${editing.date}`}
          editing={editing}
          current={cells[cellKey(editing.phase.id, editing.date)]}
          pending={pending}
          error={status?.error ? status.text : null}
          onCancel={() => setEditing(null)}
          onSave={(next) => saveCell(editing.phase.id, editing.date, next)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// The pop-up box: hours, quick amounts and a note
// ---------------------------------------------------------------------
function CellEditor({
  editing,
  current,
  pending,
  error,
  onCancel,
  onSave,
}: {
  editing: Editing;
  current: Cell | undefined;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (c: Cell) => void;
}) {
  const [hours, setHours] = useState(editing.startWith ?? (current?.hours ? show(current.hours) : ""));
  const [note, setNote] = useState(current?.note ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const hoursRef = useRef<HTMLInputElement>(null);

  // Focus the hours box; close on Escape or a click outside
  useEffect(() => {
    const input = hoursRef.current;
    input?.focus();
    if (input && !editing.startWith) input.select();
    else if (input) input.setSelectionRange(input.value.length, input.value.length);

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onCancel();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit() {
    const n = parseHours(hours);
    if (n === null || n < 0 || n > 24) {
      setProblem("Enter hours like 2, 1.5 or 1:30 (up to 24).");
      return;
    }
    if (n === 0 && note.trim()) {
      setProblem("Add hours for this note, or clear the note.");
      return;
    }
    setProblem(null);
    onSave({ hours: Math.round(n * 100) / 100, note: note.trim() });
  }

  const shown = problem ?? error;

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-modal="false"
      aria-label={`Hours for ${editing.phase.name} on ${shortDate(editing.date)}`}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-moa-text bg-moa-bg p-5 shadow-[0_-12px_40px_rgba(0,0,0,0.7)] sm:inset-x-auto sm:bottom-auto sm:w-80 sm:border"
      style={typeof window !== "undefined" && window.innerWidth >= 640 ? { top: Math.min(editing.top, window.innerHeight - 380), left: editing.left } : undefined}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-4"
      >
        <div>
          <p className="font-medium">{editing.phase.name}</p>
          <p className="text-sm text-moa-muted">{formatDay(toDayNumber(editing.date), { weekday: "long", month: "short", day: "numeric" })}</p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-moa-muted">Hours</span>
          <input
            ref={hoursRef}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            className="h-12 border-b border-moa-line bg-transparent text-2xl font-medium tabular-nums outline-none focus:border-moa-text"
          />
        </label>

        <div className="flex flex-wrap gap-2" aria-label="Quick amounts">
          {["0.5", "1", "2", "4", "8"].map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHours(h)}
              aria-pressed={hours === h}
              className={`h-9 min-w-12 border px-2 text-sm tabular-nums transition-colors ${
                hours === h ? "border-moa-text" : "border-moa-line text-moa-muted hover:text-moa-text"
              }`}
            >
              {h}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-moa-muted">Notes</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            rows={3}
            placeholder="What you worked on (optional)"
            className="resize-y border border-moa-line bg-transparent p-2 text-sm outline-none focus:border-moa-text"
          />
        </label>

        {shown && <p className="text-sm text-red-300">{shown}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="h-11 flex-1 border border-moa-text bg-moa-text font-semibold text-moa-bg transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {current?.hours ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => onSave({ hours: 0, note: "" })}
              className="h-11 px-3 text-sm text-moa-muted hover:text-moa-text"
            >
              Clear day
            </button>
          ) : null}
          <button type="button" onClick={onCancel} className="h-11 px-3 text-sm text-moa-muted hover:text-moa-text">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
