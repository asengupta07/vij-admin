"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function Filters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [appId, setAppId] = useState(searchParams.get("appId") ?? "");
  const [severity, setSeverity] = useState(searchParams.get("severity") ?? "");
  const [environment, setEnvironment] = useState(searchParams.get("environment") ?? "");
  const [origin, setOrigin] = useState(searchParams.get("origin") ?? "");
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const debounceRef = useRef<any>(null);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    appId ? params.set("appId", appId) : params.delete("appId");
    severity ? params.set("severity", severity) : params.delete("severity");
    environment ? params.set("environment", environment) : params.delete("environment");
    origin ? params.set("origin", origin) : params.delete("origin");
    search ? params.set("search", search) : params.delete("search");
    params.set("page", "1");
    return params;
  }, [searchParams, appId, severity, environment, search]);

  // Apply immediately for non-text filters
  useEffect(() => {
    const q = buildQuery();
    router.replace(`/logs?${q.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [severity, environment, origin]);

  // Debounce text inputs (appId, search)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const q = buildQuery();
      router.replace(`/logs?${q.toString()}`);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, search]);

  const reset = () => {
    router.push(`/logs`);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-col">
        <label className="text-xs text-zinc-500">App ID</label>
        <input
          value={appId}
          onChange={(e) => setAppId(e.target.value)}
          className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="demo-app"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-zinc-500">Severity</label>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">Any</option>
          <option value="error">error</option>
          <option value="warning">warning</option>
          <option value="info">info</option>
        </select>
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-zinc-500">Environment</label>
        <select
          value={environment}
          onChange={(e) => setEnvironment(e.target.value)}
          className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">Any</option>
          <option value="production">production</option>
          <option value="development">development</option>
        </select>
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-zinc-500">Origin</label>
        <select
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">Any</option>
          <option value="browser">frontend</option>
          <option value="node">backend</option>
        </select>
      </div>
      <div className="flex flex-col flex-1">
        <label className="text-xs text-zinc-500">Search</label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="message contains..."
        />
      </div>
      <div className="flex flex-col">
        <label className="invisible text-xs">Reset</label>
        <button
          onClick={reset}
          className="rounded-md border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

