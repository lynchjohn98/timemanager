"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import type { Forecast, ProjectStats } from "@/lib/forecast";
import { shortDate } from "@/lib/dates";
import { hoursText, money, pct } from "@/lib/options";
import UsageBar from "@/components/ui/UsageBar";
import VerdictDot from "@/components/ui/VerdictDot";
import QuickLog from "./QuickLog";

export type SheetRow = { stats: ProjectStats; forecast: Forecast; canManage: boolean; role: string | null };

const fmtHours = (h: number) => (h ? Number(h.toFixed(2)).toString() : "");

export default function ProjectSheet({
  rows,
  weekColumns,
  currentWeek,
  today,
  showMoney,
}: {
  rows: SheetRow[];
  weekColumns: string[];
  currentWeek: string;
  today: string;
  showMoney: boolean; // false for team members: no budgets, amounts or forecasts
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // On narrow screens, start scrolled to the right so the current week is visible
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const weekTotals = weekColumns.map((w) => rows.reduce((s, r) => s + (r.stats.weekly[w] ?? 0), 0));

  const th = "px-3 py-3 text-left text-sm font-normal text-moa-muted whitespace-nowrap";
  const td = "px-3 py-3 align-top whitespace-nowrap";
  const sticky = "sticky left-0 z-10 bg-moa-bg";

  return (
    <div ref={scrollRef} className="overflow-x-auto">
      <table className={`w-full ${showMoney ? "min-w-[1100px]" : "min-w-[760px]"} border-collapse text-sm`}>
        <thead>
          <tr className="border-b border-moa-line">
            <th className={`${th} ${sticky} pl-6 sm:pl-10`}>Project</th>
            <th className={th}>Phase now</th>
            <th className={th}>Dates</th>
            {showMoney ? (
              <>
                <th className={`${th} text-right`}>Budget</th>
                <th className={`${th} text-right`}>Logged</th>
                <th className={th}>Budget used</th>
                <th className={th}>Forecast</th>
              </>
            ) : (
              <th className={`${th} text-right`}>Your hours</th>
            )}
            {weekColumns.map((w) => (
              <th
                key={w}
                className={`${th} w-14 text-right ${w === currentWeek ? "text-moa-text" : ""}`}
                title={`Week of ${shortDate(w, true)}`}
              >
                {shortDate(w)}
              </th>
            ))}
            <th className="w-6 pr-6 sm:pr-10" />
          </tr>
        </thead>

        <tbody>
          {rows.map(({ stats: s, forecast: f, canManage, role }) => {
            const p = s.project;
            const isOpen = !!open[p.id];
            return (
              <Fragment key={p.id}>
                {/* Project row */}
                <tr className="border-b border-moa-line/70">
                  <td className={`${td} ${sticky} min-w-[260px] max-w-[320px] pl-6 sm:pl-10`}>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setOpen((o) => ({ ...o, [p.id]: !o[p.id] }))}
                        disabled={s.phases.length === 0}
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? "Hide" : "Show"} phases for ${p.name}`}
                        className="mt-1 h-4 w-4 shrink-0 text-xs text-moa-muted transition-transform hover:text-moa-text disabled:opacity-0"
                        style={{ transform: isOpen ? "rotate(90deg)" : undefined }}
                      >
                        ▶
                      </button>
                      <div className="min-w-0">
                        <Link
                          href={`/projects/${p.id}`}
                          className="flex items-center gap-2.5 text-base font-medium transition-colors hover:text-moa-muted"
                        >
                          <span aria-hidden className="h-2.5 w-2.5 shrink-0" style={{ background: p.color || "#e4e4e4" }} />
                          <span className="truncate">{p.name}</span>
                        </Link>
                        <p className="mt-0.5 flex gap-3 truncate text-moa-muted">
                          {p.client_name && <span className="truncate">{p.client_name}</span>}
                          {p.project_type && <span className="truncate">{p.project_type}</span>}
                          {p.status === "on_hold" && <span>On hold</span>}
                          {!canManage && role && <span className="truncate">{role}</span>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className={`${td} min-w-[13.5rem] max-w-[16rem] whitespace-normal`}>
                    <span className="block truncate">
                      {s.currentPhase ??
                        (s.phases.length > 0 ? <span className="text-moa-muted">All complete</span> : <span className="text-moa-muted">No phases</span>)}
                    </span>
                    {s.nextPhase && <span className="block truncate text-xs text-moa-muted">Next: {s.nextPhase}</span>}
                    {p.status !== "completed" && (
                      <QuickLog
                        projectId={p.id}
                        projectName={p.name}
                        phases={s.phases.map((ph) => ({ id: ph.phase.id, name: ph.phase.name, is_complete: ph.phase.is_complete }))}
                        currentPhaseId={s.currentPhaseId}
                        currentPhase={s.currentPhase}
                        nextPhase={s.nextPhase}
                        today={today}
                        canAdvance={canManage}
                      />
                    )}
                  </td>
                  <td className={`${td} whitespace-normal text-moa-muted`}>
                    {p.start_date ? shortDate(p.start_date) : "—"} – {p.end_date ? shortDate(p.end_date, true) : "—"}
                  </td>
                  {showMoney && canManage && (
                    <>
                  <td className={`${td} text-right`}>
                    {money(s.budget)}
                    {s.budgetHours !== null && <div className="text-moa-muted">{hoursText(Math.round(s.budgetHours))}</div>}
                  </td>
                  <td className={`${td} text-right`}>
                    {money(s.amount)}
                    <div className="text-moa-muted">{hoursText(s.hours)}</div>
                  </td>
                  <td className={`${td} w-40`}>
                    <UsageBar used={s.usedPct} elapsed={p.status === "completed" ? null : s.elapsedPct} />
                    <div className="mt-1 text-moa-muted">
                      {s.usedPct !== null ? `${pct(s.usedPct)} used` : "No budget"}
                      {p.status === "completed"
                        ? ", completed"
                        : s.elapsedPct !== null && `, ${pct(Math.min(s.elapsedPct, 9.99))} of time`}
                    </div>
                  </td>
                  <td className={`${td} w-56 min-w-[13rem] whitespace-normal`}>
                    <div className="flex items-center gap-2">
                      <VerdictDot verdict={f.verdict} />
                      {f.headline}
                    </div>
                    {f.projectedAmount !== null && (
                      <div className="mt-0.5 text-moa-muted">
                        Ends near {money(f.projectedAmount)}
                        {f.projectedPct !== null && ` (${pct(f.projectedPct)})`}
                      </div>
                    )}
                  </td>
                    </>
                  )}
                  {showMoney && !canManage && (
                    <>
                      <td className={`${td} text-right text-moa-muted`}>—</td>
                      <td className={`${td} text-right`}>{hoursText(s.hours)}<div className="text-moa-muted">yours</div></td>
                      <td className={td} />
                      <td className={td} />
                    </>
                  )}
                  {!showMoney && <td className={`${td} text-right`}>{hoursText(s.hours)}</td>}
                  {weekColumns.map((w) => (
                    <td
                      key={w}
                      className={`${td} text-right tabular-nums ${w === currentWeek ? "bg-white/[0.04]" : ""}`}
                    >
                      {fmtHours(s.weekly[w] ?? 0)}
                    </td>
                  ))}
                  <td className="pr-6 sm:pr-10" />
                </tr>

                {/* Phase rows */}
                {isOpen &&
                  s.phases.map((ph) => (
                    <tr key={ph.phase.id} className="border-b border-moa-line/40 text-moa-muted">
                      <td className={`${td} ${sticky} max-w-[320px] py-2 pl-[3.25rem] sm:pl-[4.25rem]`}>
                        <span className={`block truncate ${ph.phase.is_complete ? "line-through" : "text-moa-text"}`}>
                          {ph.phase.name}
                        </span>
                      </td>
                      <td className={`${td} py-2`}>{ph.phase.is_complete ? "Complete" : ""}</td>
                      <td className={`${td} py-2`} />
                      {showMoney && canManage && (
                        <>
                      <td className={`${td} py-2 text-right`}>{ph.phase.budget_amount !== null ? money(ph.phase.budget_amount) : ""}</td>
                      <td className={`${td} py-2 text-right`}>
                        {money(ph.amount)}
                        <span className="ml-2">{hoursText(ph.hours)}</span>
                      </td>
                      <td className={`${td} py-2`}>
                        {ph.usedPct !== null && <UsageBar used={ph.usedPct} elapsed={null} thin />}
                      </td>
                      <td className={`${td} py-2`}>{ph.usedPct !== null ? `${pct(ph.usedPct)} of phase budget` : ""}</td>
                        </>
                      )}
                      {showMoney && !canManage && (
                        <>
                          <td className={`${td} py-2`} />
                          <td className={`${td} py-2 text-right`}>{hoursText(ph.hours)}</td>
                          <td className={`${td} py-2`} />
                          <td className={`${td} py-2`} />
                        </>
                      )}
                      {!showMoney && <td className={`${td} py-2 text-right`}>{hoursText(ph.hours)}</td>}
                      {weekColumns.map((w) => (
                        <td key={w} className={`${td} py-2 text-right tabular-nums ${w === currentWeek ? "bg-white/[0.04]" : ""}`}>
                          {fmtHours(ph.weekly[w] ?? 0)}
                        </td>
                      ))}
                      <td className="pr-6 sm:pr-10" />
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>

        <tfoot>
          <tr className="border-t-2 border-moa-line">
            <td className={`${td} ${sticky} pl-6 font-medium sm:pl-10`}>Total</td>
            <td className={td} />
            <td className={td} />
            {showMoney ? (
              <>
                <td className={`${td} text-right`}>
                  {money(rows.filter((r) => r.canManage).reduce((s, r) => s + (r.stats.budget ?? 0), 0))}
                </td>
                <td className={`${td} text-right`}>
                  {money(rows.filter((r) => r.canManage).reduce((s, r) => s + r.stats.amount, 0))}
                  <div className="text-moa-muted">{hoursText(rows.reduce((s, r) => s + r.stats.hours, 0))}</div>
                </td>
                <td className={td} />
                <td className={td} />
              </>
            ) : (
              <td className={`${td} text-right font-medium`}>{hoursText(rows.reduce((s, r) => s + r.stats.hours, 0))}</td>
            )}
            {weekTotals.map((t, i) => (
              <td
                key={weekColumns[i]}
                className={`${td} text-right font-medium tabular-nums ${weekColumns[i] === currentWeek ? "bg-white/[0.04]" : ""}`}
              >
                {fmtHours(t)}
              </td>
            ))}
            <td className="pr-6 sm:pr-10" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
