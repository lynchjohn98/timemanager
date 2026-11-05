// Shared types and fixed choices (safe to use on the server and in the browser)

export type ActionState = {
  error: string | null;
  message?: string | null;
  ok?: boolean;
  id?: string;
};

export type ProjectStatus = "active" | "on_hold" | "completed";

export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
];

export const statusLabel = (s: string) => PROJECT_STATUSES.find((x) => x.value === s)?.label ?? s;

// Row colors for projects (empty = default)
export const PROJECT_COLORS = ["#e4e4e4", "#c9a66b", "#8fb3c9", "#9ec9a0", "#c98f8f", "#b39ec9", "#c9c38f", "#8fc9c4"];

export const money = (n: number | null | undefined, decimals = 0) =>
  n === null || n === undefined
    ? "—"
    : n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

export const hoursText = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `${Number(n.toFixed(2)).toLocaleString("en-US")} h`;

export const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${Math.round(n * 100)}%`);
