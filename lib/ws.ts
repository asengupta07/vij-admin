// Minimal, process-wide WebSocket server to broadcast new logs to dashboards.
// Starts once per process; safe to import from any server code path.
import type { IncomingMessage } from "node:http";

type WSLike = {
	send: (data: string) => void;
	readyState: number;
	close: () => void;
};

type Subscriber = {
	socket: WSLike;
	appId?: string;
};

// Reuse across Next.js dev hot-reloads
type GlobalWsState = {
	started: boolean;
	subscribers: Set<Subscriber>;
	wss?: any;
};
const g = globalThis as unknown as { __vijWsState?: GlobalWsState };
if (!g.__vijWsState) {
	g.__vijWsState = { started: false, subscribers: new Set() };
}
const state = g.__vijWsState as GlobalWsState;

// Lazy import to keep edge/client bundles clean
function getWSServer() {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const WebSocket = require("ws");
	return WebSocket;
}

export function startWebSocketServer() {
	if (state.started) return;
	state.started = true;
	try {
		const WebSocket = getWSServer();
		// If an instance is already created (e.g., previous reload), skip
		if (state.wss && typeof state.wss.on === "function") return;
		const port = Number(process.env.WS_PORT || process.env.NEXT_PUBLIC_WS_PORT || 3535);
		const wss = new WebSocket.Server({ port });
		state.wss = wss;

		// Swallow EADDRINUSE so dev server doesn't crash if another instance already bound
		wss.on("error", (err: any) => {
			if (err && (err.code === "EADDRINUSE" || err.errno === -48)) {
				// Another instance already running on this port; ignore
				return;
			}
			// For other errors, close quietly
			try {
				wss.close();
			} catch {}
		});

		wss.on("connection", (ws: any, req: IncomingMessage) => {
			try {
				const url = new URL(req.url || "/", "http://localhost");
				const appId = url.searchParams.get("appId") || undefined;
				const sub: Subscriber = { socket: ws as WSLike, appId };
				state.subscribers.add(sub);

				ws.on("close", () => {
					state.subscribers.delete(sub);
				});
				ws.on("error", () => {
					try {
						ws.close();
					} finally {
						state.subscribers.delete(sub);
					}
				});

				// Optional: client can send ping or update filters later
				ws.on("message", (data: Buffer) => {
					try {
						const msg = JSON.parse(data.toString());
						if (msg && msg.type === "subscribe") {
							sub.appId = typeof msg.appId === "string" ? msg.appId : undefined;
						}
					} catch {
						// ignore
					}
				});
			} catch {
				// ignore connection errors
			}
		});
	} catch {
		// If ws cannot start (e.g., port in use in dev hot-reload), ignore
	}
}

function safeSend(sub: Subscriber, payload: unknown) {
	try {
		if (!sub?.socket) return;
		// 1 = OPEN in ws; guard if available, otherwise best-effort
		if (typeof (sub.socket as any).OPEN === "number") {
			if (sub.socket.readyState !== (sub.socket as any).OPEN) return;
		}
		sub.socket.send(JSON.stringify(payload));
	} catch {
		try {
			sub.socket.close();
		} catch {
			// ignore
		}
	}
}

export function broadcastLogs(logs: any | any[]) {
	const arr = Array.isArray(logs) ? logs : [logs];
	if (arr.length === 0) return;
	const payload = { type: "log", data: arr };
	for (const sub of Array.from(state.subscribers)) {
		if (sub.appId) {
			const filtered = arr.filter((l) => !l?.appId || l.appId === sub.appId);
			if (filtered.length > 0) safeSend(sub, { type: "log", data: filtered });
		} else {
			safeSend(sub, payload);
		}
	}
}

// Auto-start when imported on the server
if (typeof window === "undefined") {
	startWebSocketServer();
}


