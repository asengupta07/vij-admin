"use client";
import useSWR from "swr";
import Link from "next/link";
import { formatISTTime } from "@/lib/time";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type LogItem = {
  _id: string;
  appId: string;
  message: string;
  severity: "error" | "warning" | "info";
  environment: "production" | "development";
  timestamp: string;
  metadata?: Record<string, unknown>;
};

function useRecent(severity: "error" | "warning" | "info", limit = 5) {
  const { data } = useSWR<{ data: LogItem[] }>(`/api/logs?severity=${severity}&limit=${limit}`, fetcher, {
    refreshInterval: 5000
  });
  return data?.data ?? [];
}

function badgeClass(sev: string) {
  switch (sev) {
    case "error":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    case "warning":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    default:
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  }
}

function MetaPreview({ meta }: { meta?: Record<string, unknown> }) {
  if (!meta) return null;
  try {
    const str = JSON.stringify(meta);
    const short = str.length > 100 ? str.slice(0, 100) + "…" : str;
    return <span className="text-xs text-zinc-500"> • {short}</span>;
  } catch {
    return null;
  }
}

function AISnippet({ text }: { text?: string }) {
  if (!text) return null;
  const short = text.length > 120 ? text.slice(0, 120) + "…" : text;
  return <div className="mt-1 text-xs text-lime-700 dark:text-lime-300">💡 {short}</div>;
}
function Column({ title, severity }: { title: string; severity: "error" | "warning" | "info" }) {
  const items = useRecent(severity, 6);
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10">
      <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-3 py-2">
        <div className="text-sm font-medium">{title}</div>
        <span className={`inline-flex rounded px-2 py-0.5 text-xs ${badgeClass(severity)}`}>{severity}</span>
      </div>
      <ul className="divide-y divide-black/10 dark:divide-white/10">
        {items.map((l) => {
          const t = new Date(l.timestamp);
          return (
            <li key={l._id} className="px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1 wrap-break-word">
                  <Link href={`/logs/${l._id}`} className="hover:underline wrap-break-word whitespace-normal">
                    {l.message}
                  </Link>
                  <MetaPreview meta={l.metadata} />
                </div>
                <div className="shrink-0 text-xs text-zinc-500">{formatISTTime(t)}</div>
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {l.appId} • {l.environment} • {(l as any).metadata?.runtime === "browser" ? "frontend" : (l as any).metadata?.runtime === "node" ? "backend" : "-"}
              </div>
              <AISnippet text={(l as any).ai?.summary ?? (l as any).ai_summary} />
              {Array.isArray((l as any).ai?.tags) && (l as any).ai.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {(l as any).ai.tags.slice(0, 3).map((t: string, i: number) => (
                    <span key={i} className="rounded border border-lime-400/40 bg-lime-200/30 px-1.5 py-0.5 text-[10px] text-lime-900 dark:bg-lime-900/20 dark:text-lime-200">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
        {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-zinc-500">No recent {severity}s</li>}
      </ul>
      <div className="border-t border-black/10 dark:border-white/10 px-3 py-2 text-right">
        <Link href={`/logs?severity=${severity}`} className="text-sm text-zinc-700 hover:underline dark:text-zinc-300">
          View all
        </Link>
      </div>
    </div>
  );
}

export default function RecentEvents() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Column title="Latest Errors" severity="error" />
      <Column title="Latest Warnings" severity="warning" />
      <Column title="Latest Info" severity="info" />
    </div>
  );
}


