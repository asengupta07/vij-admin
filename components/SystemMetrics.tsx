"use client";
import useSWR from "swr";

type Metrics = {
	ingested_total: number;
	dedup_hits_total: number;
	sample_inserted_total: number;
	rate_limit_total: number;
	backoff_advised_total: number;
	redis: string;
	mongo: string;
};

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

function Card({ label, value }: { label: string; value: number | string }) {
	return (
		<div className="rounded-lg border border-black/10 dark:border-white/10 p-3">
			<div className="text-xs text-zinc-600 dark:text-zinc-400">{label}</div>
			<div className="mt-1 text-lg font-semibold">{String(value)}</div>
		</div>
	);
}

export default function SystemMetrics() {
	const { data } = useSWR<Metrics>("/api/internal/metrics", fetcher, { refreshInterval: 5000 });
	const m = data;
	if (!m) return null;
	return (
		<div className="space-y-3">
			<h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Ingestion metrics</h3>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
				<Card label="Ingested (total)" value={m.ingested_total} />
				<Card label="Dedup hits" value={m.dedup_hits_total} />
				<Card label="Sample inserts" value={m.sample_inserted_total} />
				<Card label="Rate-limited" value={m.rate_limit_total} />
				<Card label="Backoff advised" value={m.backoff_advised_total} />
			</div>
			<div className="grid grid-cols-2 gap-3 sm:max-w-sm">
				<Card label="Mongo" value={m.mongo} />
				<Card label="Redis" value={m.redis} />
			</div>
		</div>
	);
}


