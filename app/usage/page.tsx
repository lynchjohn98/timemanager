const steps = [
  {
    title: "Create a project",
    body: "Select New project and follow the four steps: give it a title, choose its phases (from a saved set, your phase library, or new names), set the timeline, hourly rate and budget, then check the forecast before creating it.",
  },
  {
    title: "Log your hours",
    body: "Open a project from the Projects sheet. The Timesheet shows each phase against the days of the week. Type hours as 2, 1.5 or 1:30, then Save hours or press Enter. Use Previous week and Next week to fill in other weeks.",
  },
  {
    title: "Read the Projects sheet",
    body: "Each row shows the budget, what's been logged, how much of the budget is used and how much of the timeline has passed. The tick on the bar marks the time passed: spending to the right of it means the project is ahead of schedule on cost. The last columns show hours per week; select the arrow beside a project to see each phase.",
  },
  {
    title: "Understand the forecast",
    body: "The forecast blends two things: the project's own pace carried forward to its planned finish, and how finished projects of the same type with a similar budget actually turned out. Mark projects Completed in their Details so they're used for future forecasts.",
  },
  {
    title: "Reuse phases",
    body: "Every phase name you use is saved in the Phase library. Save a project's phases as a set to apply them, with their budget split, to future projects.",
  },
];

export default function UsagePage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-5xl font-medium tracking-wide">Usage</h1>
      <ol className="mt-12 border-t border-moa-line">
        {steps.map((s, i) => (
          <li key={s.title} className="grid gap-2 border-b border-moa-line py-8 sm:grid-cols-[3rem_1fr]">
            <span className="text-2xl font-medium text-moa-muted">{i + 1}</span>
            <div>
              <h2 className="text-2xl font-medium">{s.title}</h2>
              <p className="mt-2 text-lg leading-relaxed text-moa-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
