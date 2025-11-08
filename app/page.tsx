import { TrendingUp } from "lucide-react";
import ErrorTrend from "@/components/Charts/ErrorTrend";
import StatsCards from "@/components/StatsCards";
import { headers } from "next/headers";
import RecentEvents from "@/components/RecentEvents";
import SeverityPie from "@/components/Charts/SeverityPie";
import EnvPie from "@/components/Charts/EnvPie";
import OriginPie from "@/components/Charts/OriginPie";
import TopMessagesBar from "@/components/Charts/TopMessagesBar";

async function getBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  // dev fallback
  return "http://localhost:3000";
}

async function getStats() {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/stats`, { cache: "no-store" });
  if (!res.ok) return { byDay: [], bySeverity: [], topMessages: [] };
  return res.json();
}

export default async function Home() {
  const stats = await getStats();
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-5 w-5" />
        <h2 className="text-xl font-semibold tracking-tight">Overview</h2>
      </div>
      <StatsCards stats={stats} />
      <div className="rounded-lg border border-black/10 dark:border-white/10 p-5">
        <h3 className="mb-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Events per day</h3>
        <ErrorTrend data={stats.byDay} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-black/10 dark:border-white/10 p-4">
          <h3 className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">By severity</h3>
          <SeverityPie data={stats.bySeverity} />
        </div>
        <div className="rounded-lg border border-black/10 dark:border-white/10 p-4">
          <h3 className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">By environment</h3>
          <EnvPie data={stats.byEnvironment} />
        </div>
        <div className="rounded-lg border border-black/10 dark:border-white/10 p-4">
          <h3 className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">By origin</h3>
          <OriginPie data={stats.byOrigin} />
        </div>
      </div>
      <div className="rounded-lg border border-black/10 dark:border-white/10 p-4">
        <h3 className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">Top messages</h3>
        <TopMessagesBar data={stats.topMessages} />
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Recent events</h3>
        <RecentEvents />
      </div>
    </div>
  );
}
