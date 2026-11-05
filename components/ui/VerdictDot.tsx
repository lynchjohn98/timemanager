import type { Forecast } from "@/lib/forecast";

const COLORS: Record<Forecast["verdict"], string> = {
  on_track: "#9ec9a0",
  watch: "#c9c38f",
  over: "#c98f8f",
  not_started: "#5a5a5a",
  no_budget: "#5a5a5a",
};

export default function VerdictDot({ verdict }: { verdict: Forecast["verdict"] }) {
  return <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: COLORS[verdict] }} />;
}
