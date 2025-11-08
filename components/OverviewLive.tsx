"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import StatsCards from "@/components/StatsCards";
import ErrorTrend from "@/components/Charts/ErrorTrend";
import SeverityPie from "@/components/Charts/SeverityPie";
import EnvPie from "@/components/Charts/EnvPie";
import OriginPie from "@/components/Charts/OriginPie";
import TopMessagesBar from "@/components/Charts/TopMessagesBar";
import { useSearchParams } from "next/navigation";

type StatsResponse = {
	byDay: { _id: { y: number; m: number; d: number }; count: number }[];
	bySeverity: { _id: "error" | "warning" | "info"; count: number }[];
	topMessages: { _id: string; count: number }[];
	byEnvironment: { _id: string; count: number }[];
	byOrigin: { _id: string; count: number }[];
};

export default function OverviewLive({ initial }: { initial: StatsResponse }) {
	const [stats, setStats] = useState<StatsResponse>(initial);
	const wsRef = useRef<WebSocket | null>(null);
	const refreshTimer = useRef<any>(null);
	const searchParams = useSearchParams();

	const scheduleRefresh = useCallback(() => {
		if (refreshTimer.current) {
			clearTimeout(refreshTimer.current);
		}
		refreshTimer.current = setTimeout(async () => {
			try {
				const res = await fetch("/api/stats", { cache: "no-store" });
				if (res.ok) {
					const json = (await res.json()) as StatsResponse;
					setStats(json);
				}
			} catch {
				// ignore
			}
		}, 300);
	}, []);

	useEffect(() => {
		let stop = false;
		let retryTimer: any = null;
		const connect = () => {
			if (stop) return;
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
				ws.addEventListener("message", (ev) => {
					try {
						const msg = JSON.parse(ev.data as string);
						if (!msg || msg.type !== "log") return;
						scheduleRefresh();
					} catch {
						// ignore
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
			if (refreshTimer.current) {
				clearTimeout(refreshTimer.current);
				refreshTimer.current = null;
			}
		};
	}, [searchParams, scheduleRefresh]);

	return (
		<>
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
		</>
	);
}


