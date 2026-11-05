/**
 * Budget used as a filled bar, with a thin tick showing how much of the
 * timeline has passed. Fill past the tick means spending is ahead of schedule.
 */
export default function UsageBar({
  used,
  elapsed,
  thin = false,
}: {
  used: number | null;
  elapsed: number | null;
  thin?: boolean;
}) {
  if (used === null) return <div className={`${thin ? "h-1" : "h-1.5"} w-full bg-moa-line/60`} />;

  const fill = Math.min(used, 1);
  const color = used > 1 ? "#c98f8f" : elapsed !== null && used > elapsed + 0.15 ? "#c9c38f" : "#e4e4e4";

  return (
    <div
      className={`relative ${thin ? "h-1" : "h-1.5"} w-full bg-moa-line/60`}
      role="img"
      aria-label={`${Math.round(used * 100)}% of budget used${elapsed !== null ? `, ${Math.round(elapsed * 100)}% of time passed` : ""}`}
    >
      <div className="absolute inset-y-0 left-0" style={{ width: `${fill * 100}%`, background: color }} />
      {elapsed !== null && elapsed <= 1 && (
        <div className="absolute -top-1 -bottom-1 w-px bg-moa-text" style={{ left: `${elapsed * 100}%` }} />
      )}
    </div>
  );
}
