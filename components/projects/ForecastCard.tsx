import type { Forecast } from "@/lib/forecast";
import { shortDate } from "@/lib/dates";
import { money, pct } from "@/lib/options";
import VerdictDot from "@/components/ui/VerdictDot";

export default function ForecastCard({ forecast: f }: { forecast: Forecast }) {
  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-[18rem_1fr]">
      <div>
        <p className="text-sm text-moa-muted">Forecast</p>
        <p className="mt-1 flex items-center gap-3 text-2xl font-medium">
          <VerdictDot verdict={f.verdict} />
          {f.headline}
        </p>
        {f.projectedAmount !== null && (
          <p className="mt-2 text-moa-muted">
            Ends near {money(f.projectedAmount)}
            {f.projectedPct !== null && ` (${pct(f.projectedPct)} of budget)`}
            {f.projectedEnd && `, around ${shortDate(f.projectedEnd, true)}`}
          </p>
        )}
      </div>
      <ul className="flex flex-col gap-2 text-moa-muted lg:pt-6">
        {f.lines.map((l) => (
          <li key={l} className="max-w-prose">
            {l}
          </li>
        ))}
      </ul>
    </section>
  );
}
