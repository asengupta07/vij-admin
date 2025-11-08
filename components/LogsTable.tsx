"use client";
import useSWR from "swr";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { formatISTDateTime } from "@/lib/time";
import MetaCards from "@/components/MetaCards";
import { useEffect, useMemo, useRef, useState } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function LogsTable() {
  const [openMeta, setOpenMeta] = useState<Record<string, boolean>>({});
  const [live, setLive] = useState<any[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const idleTimerRef = useRef<any>(null);
  const [serverRefined, setServerRefined] = useState<any[] | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  // Load a large base set without filters; client filters instantly
  const { data } = useSWR(`/api/logs?limit=1000`, fetcher, { refreshInterval: 0, revalidateOnFocus: false });
  const baseLogs = data?.data ?? [];

  // Reset live buffer when filters or page change
  useEffect(() => {
    setLive([]);
  }, [searchParams]);

  function matchesFilters(l: any): boolean {
    const appId = searchParams.get("appId") || undefined;
    const severity = searchParams.get("severity") || undefined;
    const environment = searchParams.get("environment") || undefined;
    const fingerprint = searchParams.get("fingerprint") || undefined;
    const origin = searchParams.get("origin") || undefined; // browser|node
    const search = searchParams.get("search") || undefined;
    if (appId) {
      const a = String(l.appId || "");
      if (!a.toLowerCase().includes(appId.toLowerCase())) return false;
    }
    if (severity && l.severity !== severity) return false;
    if (environment && l.environment !== environment) return false;
    if (fingerprint && l.fingerprint !== fingerprint) return false;
    if (origin) {
      const o = l?.metadata?.runtime ?? (l?.userAgent ? "browser" : "node");
      if (origin !== o) return false;
    }
    if (search) {
      const s = search.toLowerCase();
      const mm = String(l.message || "").toLowerCase();
      const stack = String(l.stack || "").toLowerCase();
      if (!mm.includes(s) && !stack.includes(s)) return false;
    }
    return true;
  }

  // Client-side filtered + merged dataset (live + serverRefined or base)
  const logs = useMemo(() => {
    const source = serverRefined ?? baseLogs;
    const merged = [...live, ...source];
    // De-dup by _id + timestamp + message, keep latest first by timestamp desc
    const seen = new Set<string>();
    const combined = merged
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .filter((l) => {
      const key = `${l?._id ?? ""}|${l?.timestamp ?? ""}|${l?.message ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Apply filters on the combined list
    return combined.filter((l) => matchesFilters(l));
  }, [baseLogs, serverRefined, live, searchParams]);

  // Idle backend refinement: after user stops typing/changing filters for 1200ms, fetch filtered server results
  useEffect(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        const appId = searchParams.get("appId") || "";
        const severity = searchParams.get("severity") || "";
        const environment = searchParams.get("environment") || "";
        const fingerprint = searchParams.get("fingerprint") || "";
        const origin = searchParams.get("origin") || "";
        const search = searchParams.get("search") || "";
        if (appId) params.set("appId", appId);
        if (severity) params.set("severity", severity);
        if (environment) params.set("environment", environment);
        if (fingerprint) params.set("fingerprint", fingerprint);
        if (origin) params.set("origin", origin);
        if (search) params.set("search", search);
        params.set("limit", "1000");
        const res = await fetch(`/api/logs?${params.toString()}`, { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          setServerRefined(Array.isArray(json?.data) ? json.data : null);
        }
      } catch {
        // ignore
      }
    }, 1200);
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [searchParams]);

  // Live WebSocket subscription
  useEffect(() => {
    let stop = false;
    let retryTimer: any = null;

    const connect = () => {
      if (stop) return;
      // Close previous
      try {
        wsRef.current?.close();
      } catch {}
      wsRef.current = null;

      const protocol = typeof location !== "undefined" && location.protocol === "https:" ? "wss" : "ws";
      const host = typeof location !== "undefined" ? location.hostname : "localhost";
      const port = (process.env.NEXT_PUBLIC_WS_PORT as string) || "3535";
      const appId = searchParams.get("appId");
      const url = `${protocol}://${host}:${port}/?${appId ? `appId=${encodeURIComponent(appId)}` : ""}`;
      let ws: WebSocket | null = null;
      try {
        ws = new WebSocket(url);
        wsRef.current = ws;
        ws.addEventListener("open", () => {
          // connection established
        });
        ws.addEventListener("message", (ev) => {
          try {
            const msg = JSON.parse(ev.data as string);
            if (!msg || msg.type !== "log") return;
            const incoming: any[] = Array.isArray(msg.data) ? msg.data : [msg.data];
            // Apply client-side filters to incoming items
            const filtered = incoming.filter((l) => matchesFilters(l));
            if (filtered.length > 0) {
              setLive((prev) => {
                const next = [...filtered, ...prev];
                return next.slice(0, 200);
              });
            }
          } catch {
            // ignore event parse errors
          }
        });
        const scheduleRetry = () => {
          if (stop) return;
          if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
          }
          retryTimer = setTimeout(connect, 2000);
        };
        ws.addEventListener("error", () => {
          try {
            ws?.close();
          } catch {}
        });
        ws.addEventListener("close", () => {
          scheduleRetry();
        });
      } catch {
        // schedule retry if construction fails
        retryTimer = setTimeout(connect, 2000);
      }
    };

    connect();

    return () => {
      stop = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      try {
        wsRef.current?.close();
      } catch {}
      wsRef.current = null;
    };
  }, [searchParams]);

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
                        {String(l.ai?.summary ?? l.ai_summary).length > 160 ? String(l.ai?.summary ?? l.ai_summary).slice(0, 160) + "…" : String(l.ai?.summary ?? l.ai_summary)}
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

