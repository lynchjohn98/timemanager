"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { saveWeek } from "@/app/projects/actions";
import type { TimeCell } from "@/lib/data";
import { addDays, formatDay, shortDate, toDayNumber } from "@/lib/dates";
import { hoursText } from "@/lib/options";

type Row = { id: string; name: string; is_complete: boolean; totalHours: number };

const cellKey = (phaseId: string, date: string) => `${phaseId}|${date}`;

/** Accepts "2", "2.5", "2,5" or "2:30" (hours:minutes). */
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

  const toValues = (cells: TimeCell[]) =>
    Object.fromEntries(cells.map((c) => [cellKey(c.phase_id, c.work_date), show(c.hours)]));

  const [saved, setSaved] = useState<Record<string, string>>(() => toValues(initialCells));
  const [values, setValues] = useState<Record<string, string>>(saved);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const num = (k: string) => parseHours(values[k] ?? "") ?? 0;
  const invalid = Object.entries(values).filter(([, v]) => {
    const n = parseHours(v);
    return n === null || n < 0 || n > 24;
  });
  const dirty = Object.keys({ ...values, ...saved }).some((k) => (parseHours(values[k] ?? "") ?? -1) !== (parseHours(saved[k] ?? "") ?? -1));

  // Warn before closing the tab with unsaved hours
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const rowTotal = (phaseId: string) => days.reduce((s, d) => s + num(cellKey(phaseId, d)), 0);
  const dayTotal = (d: string) => phases.reduce((s, p) => s + num(cellKey(p.id, d)), 0);
  const weekTotal = days.reduce((s, d) => s + dayTotal(d), 0);

  function save() {
    if (invalid.length) {
      setMessage({ error: true, text: "Some cells aren't valid hours. Use numbers like 2, 1.5 or 1:30, up to 24 per day." });
      return;
    }
    const cells: TimeCell[] = [];
    for (const p of phases) for (const d of days) {
      const h = num(cellKey(p.id, d));
      if (h > 0) cells.push({ phase_id: p.id, work_date: d, hours: h });
    }
    startTransition(async () => {
      const result = await saveWeek(projectId, weekStart, cells);
      if (result.error) setMessage({ error: true, text: result.error });
      else {
        const normalized = Object.fromEntries(cells.map((c) => [cellKey(c.phase_id, c.work_date), show(c.hours)]));
        setSaved(normalized);
        setValues(normalized);
        setMessage({ error: false, text: result.message ?? "Saved." });
      }
    });
  }

  const weekHref = (d: string) => `/projects/${projectId}?week=${d}`;
  const isThisWeek = today >= weekStart && today <= addDays(weekStart, 6);

  if (phases.length === 0) {
    return (
      <p className="border-y border-moa-line py-6 text-moa-muted">
        This project has no phases yet.{" "}
        <Link href={`/projects/${projectId}?tab=phases`} className="text-moa-text underline underline-offset-4">
          Add phases
        </Link>{" "}
        to start logging hours.
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
                const weekday = formatDay(toDayNumber(d), { weekday: "short" });
                const isToday = d === today;
                return (
                  <th key={d} className={`w-20 px-1 py-3 text-center font-normal ${isToday ? "text-moa-text" : ""}`}>
                    <span className="block">{weekday}</span>
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
                {days.map((d) => {
                  const k = cellKey(p.id, d);
                  const v = values[k] ?? "";
                  const n = parseHours(v);
                  const bad = n === null || n < 0 || n > 24;
                  const weekend = [5, 6].includes(days.indexOf(d));
                  return (
                    <td key={d} className={`px-1 py-2 ${weekend ? "bg-white/[0.02]" : ""}`}>
                      <input
                        value={v}
                        onChange={(e) => {
                          setMessage(null);
                          setValues((x) => ({ ...x, [k]: e.target.value }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            save();
                          }
                        }}
                        inputMode="decimal"
                        aria-label={`${p.name}, ${shortDate(d)}`}
                        aria-invalid={bad || undefined}
                        placeholder="–"
                        className={`h-10 w-full border bg-transparent text-center tabular-nums outline-none transition-colors placeholder:text-moa-line focus:border-moa-text ${
                          bad ? "border-[#c98f8f]" : "border-moa-line/60"
                        }`}
                      />
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

      <div className="mt-6 flex flex-wrap items-center gap-5">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="border border-moa-text px-6 py-2.5 font-semibold transition-colors hover:bg-moa-text hover:text-moa-bg disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-moa-text"
        >
          {pending ? "Saving…" : "Save hours"}
        </button>
        {dirty && !pending && <span className="text-sm text-[#c9c38f]">Unsaved changes</span>}
        {message && (
          <span role="status" className={`text-sm ${message.error ? "text-red-300" : "text-moa-muted"}`}>
            {message.text}
          </span>
        )}
      </div>
      <p className="mt-3 text-sm text-moa-muted">Type hours as 2, 1.5 or 1:30. Press Enter to save.</p>

      {team.length > 0 && (
        <p className="mt-8 border-t border-moa-line pt-4 text-sm text-moa-muted">
          Everyone on this project this week:{" "}
          {team.map((t, i) => (
            <span key={t.name + i}>
              {i > 0 && ", "}
              <span className="text-moa-text">{t.name}</span> {hoursText(t.hours)}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
