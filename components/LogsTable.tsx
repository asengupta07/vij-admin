"use client";
import useSWR from "swr";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { formatISTDateTime } from "@/lib/time";
import MetaCards from "@/components/MetaCards";
import { useState } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function LogsTable() {
  const [openMeta, setOpenMeta] = useState<Record<string, boolean>>({});
  const searchParams = useSearchParams();
  const router = useRouter();
  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "20");
  const qs = searchParams.toString();
  const { data } = useSWR(`/api/logs?${qs}`, fetcher, { refreshInterval: 5000 });
  const logs = data?.data ?? [];
  const total = data?.total ?? 0;
  const hasMore = data?.hasMore ?? false;

  const nextPage = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page + 1));
    router.push(`/logs?${params.toString()}`);
  };
  const prevPage = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(Math.max(1, page - 1)));
    router.push(`/logs?${params.toString()}`);
  };

  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-100 dark:bg-zinc-900">
          <tr className="text-left">
            <th className="px-3 py-2">Time</th>
            <th className="px-3 py-2">App</th>
            <th className="px-3 py-2">Origin</th>
            <th className="px-3 py-2">Severity</th>
            <th className="px-3 py-2">Message</th>
            <th className="px-3 py-2">Env</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l: any) => {
            const id = l._id;
            const t = new Date(l.timestamp);
            const origin = l?.metadata?.runtime ?? (l?.userAgent ? "browser" : "node");
            return (
              <tr key={id} className="border-t border-black/5 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                <td className="px-3 py-2 whitespace-nowrap">{formatISTDateTime(t)}</td>
                <td className="px-3 py-2">{l.appId}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded px-2 py-0.5 text-xs ${originBadge(origin)}`}>
                    {origin === "browser" ? "frontend" : origin === "node" ? "backend" : origin ?? "-"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded px-2 py-0.5 text-xs ${badgeClass(l.severity)}`}>{l.severity}</span>
                </td>
                <td className="px-3 py-2 max-w-[520px] wrap-break-word whitespace-normal">
                  <Link href={`/logs/${id}`} className="text-zinc-900 dark:text-zinc-100 hover:underline">
                    {l.message}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {(l.ai?.summary || l.ai_summary) && (
                      <div className="text-xs text-lime-700 dark:text-lime-300">
                        💡 {String(l.ai?.summary ?? l.ai_summary).length > 160 ? String(l.ai?.summary ?? l.ai_summary).slice(0, 160) + "…" : String(l.ai?.summary ?? l.ai_summary)}
                      </div>
                    )}
                    <button
                      className="rounded border border-black/20 px-2 py-0.5 text-[11px] text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      onClick={() => setOpenMeta((s) => ({ ...s, [id]: !s[id] }))}
                    >
                      {openMeta[id] ? "Hide metadata" : "Show metadata"}
                    </button>
                  </div>
                  {Array.isArray(l.ai?.tags) && l.ai.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {l.ai.tags.slice(0, 4).map((t: string, i: number) => (
                        <span key={i} className="rounded border border-lime-400/40 bg-lime-200/30 px-1.5 py-0.5 text-[10px] text-lime-900 dark:bg-lime-900/20 dark:text-lime-200">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">{l.environment}</td>
              </tr>
            );
          })}
          {logs.map((l: any) => {
            const id = l._id;
            if (!openMeta[id]) return null;
            return (
              <tr key={`${id}-meta`} className="border-t border-black/5 dark:border-white/5">
                <td colSpan={6} className="px-3 py-3 bg-zinc-50/70 dark:bg-zinc-900/40">
                  <MetaCards metadata={l.metadata} compact />
                </td>
              </tr>
            );
          })}
          {logs.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                No logs
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t border-black/10 dark:border-white/10 px-3 py-2 text-sm">
        <div>
          Page {page} • {total} total
        </div>
        <div className="flex gap-2">
          <button onClick={prevPage} disabled={page <= 1} className="rounded-md border border-black/10 dark:border-white/10 px-2 py-1 disabled:opacity-50">
            Prev
          </button>
          <button onClick={nextPage} disabled={!hasMore} className="rounded-md border border-black/10 dark:border-white/10 px-2 py-1 disabled:opacity-50">
            Next
          </button>
        </div>
      </div>
    </div>
  );
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

function originBadge(origin: string) {
  switch (origin) {
    case "browser":
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300";
    case "node":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    default:
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-300";
  }
}

