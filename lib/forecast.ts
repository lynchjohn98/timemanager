// Budget statistics and forecasting. Pure functions: no database access,
// so they run on the server and in the browser (New project wizard).

import type { Phase, Project, WeekTotal } from "@/lib/data";
import { addDays, daysBetween, mondayOf } from "@/lib/dates";
import { money, pct } from "@/lib/options";

export type PhaseStats = {
  phase: Phase;
  hours: number;
  amount: number;
  usedPct: number | null; // amount / phase budget
  weekly: Record<string, number>; // week_start → hours
};

export type ProjectStats = {
  project: Project;
  phases: PhaseStats[];
  hours: number;
  amount: number;
  budget: number | null;
  budgetHours: number | null;
  usedPct: number | null; // amount / budget
  plannedDays: number | null; // start → planned end, inclusive
  elapsedPct: number | null; // share of the planned timeline that has passed (can pass 100%)
  lastWorkWeek: string | null;
  currentPhase: string | null;
  currentPhaseId: string | null;
  nextPhase: string | null; // the phase after the current one, if any
  weekly: Record<string, number>; // week_start → hours
  weeklyAmount: Record<string, number>; // week_start → dollars
};

// ---------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------
export function buildStats(projects: Project[], phases: Phase[], weeks: WeekTotal[], today: string): ProjectStats[] {
  const phasesByProject = new Map<string, Phase[]>();
  for (const ph of phases) {
    const list = phasesByProject.get(ph.project_id) ?? [];
    list.push(ph);
    phasesByProject.set(ph.project_id, list);
  }

  const weeksByPhase = new Map<string, WeekTotal[]>();
  for (const w of weeks) {
    const list = weeksByPhase.get(w.phase_id) ?? [];
    list.push(w);
    weeksByPhase.set(w.phase_id, list);
  }

  return projects.map((project) => {
    const projectPhases = (phasesByProject.get(project.id) ?? []).sort((a, b) => a.sort_order - b.sort_order);
    const weekly: Record<string, number> = {};
    const weeklyAmount: Record<string, number> = {};

    const phaseStats: PhaseStats[] = projectPhases.map((phase) => {
      const phaseWeekly: Record<string, number> = {};
      let hours = 0;
      let amount = 0;
      for (const w of weeksByPhase.get(phase.id) ?? []) {
        hours += w.hours;
        amount += w.amount;
        phaseWeekly[w.week_start] = (phaseWeekly[w.week_start] ?? 0) + w.hours;
        weekly[w.week_start] = (weekly[w.week_start] ?? 0) + w.hours;
        weeklyAmount[w.week_start] = (weeklyAmount[w.week_start] ?? 0) + w.amount;
      }
      return {
        phase,
        hours,
        amount,
        usedPct: phase.budget_amount ? amount / phase.budget_amount : null,
        weekly: phaseWeekly,
      };
    });

    const hours = phaseStats.reduce((s, p) => s + p.hours, 0);
    const amount = phaseStats.reduce((s, p) => s + p.amount, 0);
    const budget = project.budget_amount && project.budget_amount > 0 ? project.budget_amount : null;

    const plannedDays =
      project.start_date && project.end_date ? daysBetween(project.start_date, project.end_date) + 1 : null;
    const elapsedPct =
      project.start_date && plannedDays
        ? Math.max(0, (daysBetween(project.start_date, today) + 1) / plannedDays)
        : null;

    const workedWeeks = Object.keys(weekly).sort();
    const lastWorkWeek = workedWeeks.at(-1) ?? null;

    return {
      project,
      phases: phaseStats,
      hours,
      amount,
      budget,
      budgetHours: budget && project.hourly_rate > 0 ? budget / project.hourly_rate : null,
      usedPct: budget ? amount / budget : null,
      plannedDays,
      elapsedPct,
      lastWorkWeek,
      ...currentPhaseInfo(phaseStats, lastWorkWeek),
      weekly,
      weeklyAmount,
    };
  });
}

/**
 * The phase the project is in now:
 * - the phase worked most in the latest week, if it isn't marked complete;
 * - otherwise the first unfinished phase after it (so "Next phase" moves forward);
 * - otherwise the first unfinished phase.
 */
function currentPhaseInfo(phases: PhaseStats[], lastWeek: string | null) {
  let index = -1;
  if (lastWeek) {
    let bestHours = 0;
    phases.forEach((p, i) => {
      const h = p.weekly[lastWeek] ?? 0;
      if (h > bestHours) {
        bestHours = h;
        index = i;
      }
    });
  }

  let current = index >= 0 && !phases[index].phase.is_complete ? index : -1;
  if (current < 0) current = phases.findIndex((p, i) => i > index && !p.phase.is_complete);
  if (current < 0) current = phases.findIndex((p) => !p.phase.is_complete);

  if (current < 0) return { currentPhase: null, currentPhaseId: null, nextPhase: null };
  const next = phases.find((p, i) => i > current && !p.phase.is_complete);
  return {
    currentPhase: phases[current].phase.name,
    currentPhaseId: phases[current].phase.id,
    nextPhase: next?.phase.name ?? null,
  };
}

// ---------------------------------------------------------------------
// Forecast
// ---------------------------------------------------------------------
export type ForecastTarget = {
  id: string | null; // null for a project that doesn't exist yet
  completed?: boolean;
  projectType: string | null;
  budget: number | null;
  startDate: string | null;
  plannedDays: number | null;
  amount: number;
  usedPct: number | null;
  elapsedPct: number | null;
  phaseNames: string[];
};

export type Forecast = {
  verdict: "on_track" | "watch" | "over" | "not_started" | "no_budget";
  headline: string;
  projectedAmount: number | null;
  projectedPct: number | null;
  projectedEnd: string | null;
  similarCount: number;
  lines: string[];
};

export const targetFromStats = (s: ProjectStats): ForecastTarget => ({
  id: s.project.id,
  completed: s.project.status === "completed",
  projectType: s.project.project_type,
  budget: s.budget,
  startDate: s.project.start_date,
  plannedDays: s.plannedDays,
  amount: s.amount,
  usedPct: s.usedPct,
  elapsedPct: s.elapsedPct,
  phaseNames: s.phases.map((p) => p.phase.name),
});

const sameText = (a: string | null, b: string | null) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Completed projects most like the target: same type if possible, budget within 3× either way. */
export function findSimilar(target: ForecastTarget, all: ProjectStats[]) {
  if (!target.budget) return [];
  const finished = all.filter(
    (c) => c.project.id !== target.id && c.project.status === "completed" && c.budget && c.amount > 0
  );
  const sameType = finished.filter((c) => sameText(c.project.project_type, target.projectType));
  const pool = sameType.length > 0 ? sameType : finished;

  return pool
    .map((c) => {
      const budgetGap = Math.abs(Math.log(c.budget! / target.budget!));
      return { stats: c, weight: 1 / (1 + budgetGap), budgetGap };
    })
    .filter((c) => c.budgetGap <= Math.log(3))
    .sort((a, b) => b.weight - a.weight);
}

/** For a finished project: how long it actually ran compared with its plan. */
function durationRatio(c: ProjectStats) {
  if (!c.project.start_date || !c.plannedDays || !c.lastWorkWeek) return null;
  const actualDays = daysBetween(c.project.start_date, addDays(c.lastWorkWeek, 6)) + 1;
  return actualDays / c.plannedDays;
}

/** Share of budget a finished project had used by the same point in its planned timeline. */
function usedAt(c: ProjectStats, fraction: number) {
  if (!c.project.start_date || !c.plannedDays || !c.budget) return null;
  const cutoff = addDays(c.project.start_date, Math.round(c.plannedDays * fraction));
  let spent = 0;
  for (const [week, amount] of Object.entries(c.weeklyAmount)) if (week <= cutoff) spent += amount;
  return spent / c.budget;
}

/** How far through its phases (0–1) a finished project was at the same point in its timeline. */
function phasePositionAt(c: ProjectStats, fraction: number) {
  if (!c.project.start_date || !c.plannedDays || c.phases.length === 0) return null;
  const cutoffWeek = mondayOf(addDays(c.project.start_date, Math.round(c.plannedDays * fraction)));
  const weeksWorked = Object.keys(c.weekly).filter((w) => w <= cutoffWeek).sort();
  const week = weeksWorked.at(-1);
  if (!week) return 0;

  let bestIndex = 0;
  let bestHours = -1;
  c.phases.forEach((p, i) => {
    const h = p.weekly[week] ?? 0;
    if (h > bestHours) {
      bestHours = h;
      bestIndex = i;
    }
  });
  return (bestIndex + 0.5) / c.phases.length;
}

export function forecast(target: ForecastTarget, all: ProjectStats[]): Forecast {
  const lines: string[] = [];

  if (!target.budget) {
    return {
      verdict: "no_budget",
      headline: "No budget set",
      projectedAmount: null,
      projectedPct: null,
      projectedEnd: null,
      similarCount: 0,
      lines: ["Add a budget to see how this project is tracking."],
    };
  }

  const budget = target.budget;
  const elapsed = target.elapsedPct;

  // Finished projects: report the outcome instead of a forecast
  if (target.completed) {
    const used = target.amount / budget;
    return {
      verdict: used > 1.05 ? "over" : used > 1 ? "watch" : "on_track",
      headline: `Finished at ${pct(used)} of budget`,
      projectedAmount: null,
      projectedPct: null,
      projectedEnd: null,
      similarCount: 0,
      lines: [`Final cost ${money(target.amount)} against a budget of ${money(budget)}.`],
    };
  }

  // 1. Current pace carried forward to the planned end date
  let paceProjected: number | null = null;
  if (elapsed !== null && elapsed >= 0.05 && target.amount > 0) {
    paceProjected = elapsed >= 1 ? target.amount : target.amount / elapsed;
  }

  // 2. Similar finished projects
  const similar = findSimilar(target, all);
  let similarProjected: number | null = null;
  let projectedEnd: string | null = null;
  let expectedUsedNow: number | null = null;
  let expectedPhase: string | null = null;

  if (similar.length > 0) {
    const totalWeight = similar.reduce((s, c) => s + c.weight, 0);
    const costRatio = similar.reduce((s, c) => s + c.weight * (c.stats.amount / c.stats.budget!), 0) / totalWeight;
    similarProjected = budget * costRatio;

    const withDuration = similar
      .map((c) => ({ ...c, ratio: durationRatio(c.stats) }))
      .filter((c): c is typeof c & { ratio: number } => c.ratio !== null);
    const durRatio = withDuration.length
      ? withDuration.reduce((s, c) => s + c.weight * c.ratio, 0) / withDuration.reduce((s, c) => s + c.weight, 0)
      : null;

    if (target.startDate && target.plannedDays && durRatio) {
      projectedEnd = addDays(target.startDate, Math.round(target.plannedDays * durRatio) - 1);
    }

    const typeText = target.projectType ? `${target.projectType} ` : "";
    lines.push(
      `${similar.length} similar ${typeText}project${similar.length === 1 ? "" : "s"} with budgets near ${money(budget)} ` +
        `finished at ${pct(costRatio)} of budget` +
        (durRatio ? ` and took ${pct(durRatio)} of their planned time.` : ".")
    );

    if (elapsed !== null && elapsed >= 0.05 && elapsed <= 1.5) {
      const used = similar
        .map((c) => ({ w: c.weight, v: usedAt(c.stats, elapsed) }))
        .filter((x): x is { w: number; v: number } => x.v !== null);
      if (used.length) expectedUsedNow = used.reduce((s, x) => s + x.w * x.v, 0) / used.reduce((s, x) => s + x.w, 0);

      const positions = similar
        .map((c) => ({ w: c.weight, v: phasePositionAt(c.stats, elapsed) }))
        .filter((x): x is { w: number; v: number } => x.v !== null);
      if (positions.length && target.phaseNames.length) {
        const pos = positions.reduce((s, x) => s + x.w * x.v, 0) / positions.reduce((s, x) => s + x.w, 0);
        const i = Math.min(target.phaseNames.length - 1, Math.floor(pos * target.phaseNames.length));
        expectedPhase = `${target.phaseNames[i]} (phase ${i + 1} of ${target.phaseNames.length})`;
      }

      if (expectedUsedNow !== null || expectedPhase) {
        lines.push(
          `At this point in their schedules they had used ${expectedUsedNow !== null ? pct(expectedUsedNow) : "an unknown share"} of budget` +
            (expectedPhase ? ` and were typically in ${expectedPhase}.` : ".")
        );
      }
    }
  } else if (all.some((c) => c.project.status === "completed")) {
    lines.push("No finished projects with a similar type and budget yet, so this uses the current pace only.");
  } else {
    lines.push("Forecasts improve once you have finished projects to compare against.");
  }

  // Current position
  if (target.usedPct !== null && elapsed !== null && target.amount > 0) {
    lines.unshift(`${pct(target.usedPct)} of the budget is used with ${pct(Math.min(elapsed, 9.99))} of the timeline gone.`);
  }
  if (paceProjected !== null && elapsed !== null && elapsed < 1) {
    lines.push(`At the current pace it would finish around ${money(paceProjected)} (${pct(paceProjected / budget)} of budget).`);
  }

  // Blend: early on, trust similar projects more; later, trust the actual pace more
  let projected: number | null = null;
  if (paceProjected !== null && similarProjected !== null) {
    const w = Math.min(1, Math.max(0, elapsed ?? 0));
    projected = paceProjected * w + similarProjected * (1 - w);
  } else {
    projected = paceProjected ?? similarProjected;
  }
  const projectedPct = projected !== null ? projected / budget : null;

  let verdict: Forecast["verdict"];
  if (target.amount === 0) verdict = "not_started";
  else if (projectedPct !== null && projectedPct > 1.1) verdict = "over";
  else if (
    (projectedPct !== null && projectedPct > 1) ||
    (expectedUsedNow !== null && target.usedPct !== null && target.usedPct - expectedUsedNow > 0.15) ||
    (target.usedPct !== null && target.usedPct > 1)
  )
    verdict = "watch";
  else verdict = "on_track";

  // Before any hours are logged, describe what similar projects suggest instead
  let notStarted = "No hours logged yet";
  if (verdict === "not_started" && similarProjected !== null) {
    const over = similarProjected / budget - 1;
    notStarted =
      over > 0.02
        ? `Similar projects ran ${Math.round(over * 100)}% over`
        : over < -0.02
          ? `Similar projects came in ${Math.round(-over * 100)}% under`
          : "Similar projects stayed on budget";
  }

  const headline = {
    on_track: "On track",
    watch: "Watch closely",
    over: "Likely over budget",
    not_started: notStarted,
    no_budget: "No budget set",
  }[verdict];

  return {
    verdict,
    headline,
    projectedAmount: projected,
    projectedPct,
    projectedEnd,
    similarCount: similar.length,
    lines,
  };
}
