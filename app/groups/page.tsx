import Link from "next/link";
import { headers } from "next/headers";

async function getBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

async function getGroups(sp: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  if (typeof sp.appId === "string") params.set("appId", sp.appId);
  if (typeof sp.severity === "string") params.set("severity", sp.severity);
  if (typeof sp.environment === "string") params.set("environment", sp.environment);
  const base = await getBaseUrl();
  const qs = params.toString();
  const url = qs ? `${base}/api/groups?${qs}` : `${base}/api/groups`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { data: [] };
  return res.json();
}

export default async function GroupsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { data } = await getGroups(sp);
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold tracking-tight">Error groups</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data.map((g: any) => (
          <div key={g._id} className="rounded-lg border border-black/10 dark:border-white/10 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">{g.messageSample}</div>
              <span className="text-xs text-zinc-500">{new Date(g.lastSeen).toISOString()}</span>
            </div>
            <div className="mt-1 text-xs text-zinc-500">App: {g.appId} • Severity: {g.severity} • Count: {g.occurrenceCount}</div>
            <div className="mt-2">
              <Link href={`/logs?fingerprint=${g.fingerprint}`} className="text-sm text-zinc-700 hover:underline dark:text-zinc-300">
                View logs
              </Link>
            </div>
          </div>
        ))}
        {data.length === 0 && <div className="text-sm text-zinc-500">No groups</div>}
      </div>
    </div>
  );
}


