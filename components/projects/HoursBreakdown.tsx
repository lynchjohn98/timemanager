"use client";

import { useMemo, useState } from "react";
import type { EntryDetail } from "@/lib/data";
import { formatDay, shortDate, toDayNumber } from "@/lib/dates";
import { hoursText, money } from "@/lib/options";
import { inputClass } from "@/components/ui/forms";

type PhaseRef = { id: string; name: string };

const PAGE = 50;
const h = (n: number) => (n ? String(Math.round(n * 100) / 100) : "");

/** Who logged what: totals by person and phase, plus every entry with its note. */
export default function HoursBreakdown({
  projectName,
  entries,
  phases,
  currentUserId,
}: {
  projectName: string;
  entries: EntryDetail[];
  phases: PhaseRef[];
  currentUserId: string;
}) {
  const [person, setPerson] = useState("");
  const [phase, setPhase] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [shown, setShown] = useState(PAGE);

  const phaseName = (id: string) => phases.find((p) => p.id === id)?.name ?? "Removed phase";

  const people = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) map.set(e.user_id, e.user_name);
    return [...map].map(([id, name]) => ({ id, name: id === currentUserId ? `${name} (you)` : name }));
  }, [entries, currentUserId]);

  const filtered = useMemo(
    () =>
      entries.filter(
        (e) =>
          (!person || e.user_id === person) &&
          (!phase || e.phase_id === phase) &&
          (!from || e.work_date >= from) &&
          (!to || e.work_date <= to)
      ),
    [entries, person, phase, from, to]
  );

  const amount = (e: EntryDetail) => (e.billable ? e.hours * e.rate : 0);
  const totalHours = filtered.reduce((s, e) => s + e.hours, 0);
  const totalAmount = filtered.reduce((s, e) => s + amount(e), 0);

  // Person × phase grid
  const grid = people
    .filter((pp) => !person || pp.id === person)
    .map((pp) => {
      const mine = filtered.filter((e) => e.user_id === pp.id);
      return {
        ...pp,
        byPhase: Object.fromEntries(phases.map((ph) => [ph.id, mine.filter((e) => e.phase_id === ph.id).reduce((s, e) => s + e.hours, 0)])),
        hours: mine.reduce((s, e) => s + e.hours, 0),
        amount: mine.reduce((s, e) => s + amount(e), 0),
      };
    })
    .filter((r) => r.hours > 0);
  const gridPhases = phases.filter((ph) => !phase || ph.id === phase);

  const filtersOn = person || phase || from || to;

  function downloadCsv() {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [
      ["Date", "Person", "Phase", "Hours", "Rate", "Amount", "Billable", "Note"].map(esc).join(","),
      ...filtered.map((e) =>
        [e.work_date, e.user_name, phaseName(e.phase_id), e.hours, e.rate, amount(e).toFixed(2), e.billable ? "Yes" : "No", e.note ?? ""]
          .map(esc)
          .join(",")
      ),
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/[^\w\- ]+/g, "").trim() || "project"} hours.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (entries.length === 0) {
    return (
      <p className="border-y border-moa-line py-6 text-moa-muted">
        No hours have been logged on this project yet. Log them on the Timesheet tab or with Log hours on the Projects sheet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      {/* Filters */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_10rem_10rem_auto] lg:items-end">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-moa-muted">Person</span>
          <select value={person} onChange={(e) => { setPerson(e.target.value); setShown(PAGE); }} className={`${inputClass} h-11`}>
            <option value="">Everyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-moa-muted">Phase</span>
          <select value={phase} onChange={(e) => { setPhase(e.target.value); setShown(PAGE); }} className={`${inputClass} h-11`}>
            <option value="">All phases</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-moa-muted">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputClass} h-11`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-moa-muted">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputClass} h-11`} />
        </label>
        <div className="flex h-11 items-center gap-4">
          {filtersOn && (
            <button
              type="button"
              onClick={() => { setPerson(""); setPhase(""); setFrom(""); setTo(""); }}
              className="text-sm text-moa-muted hover:text-moa-text"
            >
              Clear filters
            </button>
          )}
          <button
            type="button"
            onClick={downloadCsv}
            disabled={filtered.length === 0}
            className="h-11 border border-moa-text px-4 font-semibold transition-colors hover:bg-moa-text hover:text-moa-bg disabled:opacity-40"
          >
            Download CSV
          </button>
        </div>
      </section>

      {/* Totals */}
      <section className="grid gap-6 border-y border-moa-line py-6 sm:grid-cols-3">
        <div>
          <p className="text-sm text-moa-muted">Hours</p>
          <p className="mt-1 text-3xl font-medium">{hoursText(totalHours)}</p>
        </div>
        <div>
          <p className="text-sm text-moa-muted">Billed value</p>
          <p className="mt-1 text-3xl font-medium">{money(totalAmount)}</p>
        </div>
        <div>
          <p className="text-sm text-moa-muted">Entries</p>
          <p className="mt-1 text-3xl font-medium">{filtered.length}</p>
          {filtersOn && <p className="text-sm text-moa-muted">of {entries.length} in total</p>}
        </div>
      </section>

      {/* Person × phase */}
      <section>
        <h2 className="mb-4 text-2xl font-medium">By person and phase</h2>
        {grid.length === 0 ? (
          <p className="text-moa-muted">No hours match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-moa-line text-moa-muted">
                  <th className="sticky left-0 bg-moa-bg py-3 pr-4 text-left font-normal">Person</th>
                  {gridPhases.map((ph) => (
                    <th key={ph.id} className="max-w-[9rem] px-3 py-3 text-right font-normal" title={ph.name}>
                      <span className="line-clamp-2">{ph.name}</span>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right font-normal">Total</th>
                  <th className="py-3 pl-3 text-right font-normal">Value</th>
                </tr>
              </thead>
              <tbody>
                {grid.map((r) => (
                  <tr key={r.id} className="border-b border-moa-line/60">
                    <td className="sticky left-0 bg-moa-bg py-3 pr-4 text-base font-medium">{r.name}</td>
                    {gridPhases.map((ph) => (
                      <td key={ph.id} className="px-3 py-3 text-right tabular-nums">
                        {h(r.byPhase[ph.id]) || <span className="text-moa-line">–</span>}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right font-medium tabular-nums">{h(r.hours)} h</td>
                    <td className="py-3 pl-3 text-right tabular-nums">{money(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
              {grid.length > 1 && (
                <tfoot>
                  <tr className="text-moa-muted">
                    <td className="sticky left-0 bg-moa-bg py-3 pr-4">Total</td>
                    {gridPhases.map((ph) => (
                      <td key={ph.id} className="px-3 py-3 text-right tabular-nums">
                        {h(grid.reduce((s, r) => s + (r.byPhase[ph.id] ?? 0), 0))}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-moa-text">{h(totalHours)} h</td>
                    <td className="py-3 pl-3 text-right tabular-nums text-moa-text">{money(totalAmount)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </section>

      {/* Every entry */}
      <section>
        <h2 className="mb-1 text-2xl font-medium">All entries</h2>
        <p className="mb-4 text-sm text-moa-muted">Notes come from Log hours on the Projects sheet.</p>
        {filtered.length === 0 ? (
          <p className="text-moa-muted">No entries match these filters.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-moa-line text-left text-moa-muted">
                    <th className="py-3 pr-4 font-normal">Date</th>
                    <th className="py-3 pr-4 font-normal">Person</th>
                    <th className="py-3 pr-4 font-normal">Phase</th>
                    <th className="py-3 pr-4 text-right font-normal">Hours</th>
                    <th className="py-3 pr-4 text-right font-normal">Rate</th>
                    <th className="py-3 pr-4 text-right font-normal">Amount</th>
                    <th className="py-3 font-normal">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, shown).map((e) => (
                    <tr key={e.id} className="border-b border-moa-line/60 align-top">
                      <td className="whitespace-nowrap py-3 pr-4">
                        {formatDay(toDayNumber(e.work_date), { weekday: "short" })} {shortDate(e.work_date, true)}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4">{e.user_id === currentUserId ? `${e.user_name} (you)` : e.user_name}</td>
                      <td className="py-3 pr-4">{phaseName(e.phase_id)}</td>
                      <td className="py-3 pr-4 text-right font-medium tabular-nums">{h(e.hours)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-moa-muted">{e.rate ? money(e.rate) : "—"}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {e.billable ? money(amount(e), 2) : <span className="text-moa-muted">Not billable</span>}
                      </td>
                      <td className="max-w-[24rem] whitespace-pre-line py-3 text-moa-muted">{e.note || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > shown && (
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE)}
                className="mt-4 h-11 border border-moa-line px-4 font-medium transition-colors hover:border-moa-text"
              >
                Show {Math.min(PAGE, filtered.length - shown)} more of {filtered.length - shown}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
