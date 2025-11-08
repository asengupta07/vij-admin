import { TrendingUp } from "lucide-react";
import { headers } from "next/headers";
import RecentEvents from "@/components/RecentEvents";
import OverviewLive from "@/components/OverviewLive";

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
      <OverviewLive initial={stats} />
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Recent events</h3>
        <RecentEvents />
      </div>
    </div>
  );
}
