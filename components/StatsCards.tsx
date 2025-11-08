type StatsResponse = {
  byDay: { _id: { y: number; m: number; d: number }; count: number }[];
  bySeverity: { _id: "error" | "warning" | "info"; count: number }[];
  topMessages: { _id: string; count: number }[];
};

export default function StatsCards({ stats }: { stats: StatsResponse }) {
  const total = stats.byDay.reduce((sum, x) => sum + x.count, 0);
  const bySeverity = Object.fromEntries(stats.bySeverity.map((s) => [s._id, s.count])) as Record<
    "error" | "warning" | "info",
    number
  >;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      <div className="rounded-lg border border-black/10 dark:border-white/10 p-4">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Total events (14d)</div>
        <div className="mt-1 text-2xl font-semibold">{total}</div>
      </div>
      <div className="rounded-lg border border-black/10 dark:border-white/10 p-4">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Errors</div>
        <div className="mt-1 text-2xl font-semibold">{bySeverity.error ?? 0}</div>
      </div>
      <div className="rounded-lg border border-black/10 dark:border-white/10 p-4">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Warnings</div>
        <div className="mt-1 text-2xl font-semibold">{bySeverity.warning ?? 0}</div>
      </div>
      <div className="rounded-lg border border-black/10 dark:border-white/10 p-4">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Info</div>
        <div className="mt-1 text-2xl font-semibold">{bySeverity.info ?? 0}</div>
      </div>
    </div>
  );
}


