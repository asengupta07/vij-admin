import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { LogModel } from "@/models/Log";
import { summarizeErrorStructured } from "@/lib/ai";
import crypto from "node:crypto";
import { ErrorGroupModel } from "@/models/ErrorGroup";
import { AiCacheModel } from "@/models/AiCache";
import { broadcastLogs } from "@/lib/ws";
import { getRedis } from "@/lib/redis";

const severityEnum = z.enum(["error", "warning", "info"]);
const envEnum = z.enum(["production", "development"]);

const SingleLogSchema = z.object({
  appId: z.string().min(1),
  message: z.string().min(1),
  stack: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
  severity: severityEnum.default("error"),
  environment: envEnum.default("production"),
  userAgent: z.string().optional(),
  occurrenceDelta: z.number().int().positive().max(1000).optional()
});

const BatchLogSchema = z.object({
  batch: z.literal(true),
  logs: z.array(SingleLogSchema)
});

type SingleLog = z.infer<typeof SingleLogSchema>;
type BatchLog = z.infer<typeof BatchLogSchema>;

const LogSchema = z.union([SingleLogSchema, BatchLogSchema]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type"
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

const MAX_BODY_BYTES = 10 * 1024; // 10KB
const RATE_LIMIT_PER_MIN = Number(process.env.VIJ_RATE_LIMIT_PER_MIN || "100");
const DEDUP_WINDOW_MS = Number(process.env.VIJ_DEDUP_WINDOW_MS || "5000");
const DISABLE_DEDUP = String(process.env.VIJ_DISABLE_DEDUP || "").toLowerCase() === "true";

export async function POST(req: NextRequest) {
  await getDb();
  const text = await req.text().catch(() => null);
  if (typeof text !== "string") {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400, headers: corsHeaders });
  }
  if (text.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413, headers: corsHeaders });
  }
  const json = (() => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  })();
  const parsed = LogSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400, headers: corsHeaders });
  }
  const body = parsed.data as SingleLog | BatchLog;
  const now = new Date();
  // Rate limit per appId (Redis). If Redis not configured, skip RL.
  const redis = getRedis();
  if (redis) {
    const appIds: string[] =
      "batch" in body && body.batch ? Array.from(new Set(body.logs.map((l) => l.appId))) : [(body as SingleLog).appId];
    const minuteKey = Math.floor(Date.now() / 60000);
    let overLimit = false;
    for (const appId of appIds) {
      try {
        const key = `rl:${appId}:${minuteKey}`;
        const count = await redis.incr(key);
        if (count === 1) {
          await redis.expire(key, 60);
        }
        if (count > RATE_LIMIT_PER_MIN) {
          overLimit = true;
          break;
        }
      } catch {
        // ignore redis errors and proceed
      }
    }
    if (overLimit) {
      try {
        await redis.incr("metrics:rate_limit_total");
        await redis.incr("metrics:backoff_advised_total");
      } catch {}
      // structured log
      try {
        // eslint-disable-next-line no-console
        console.info(JSON.stringify({ src: "vij-admin", event: "rate_limited", appIds, window: "1m", limit: RATE_LIMIT_PER_MIN }));
      } catch {}
      const headers = { ...corsHeaders, "x-vij-backoff": "10", "Retry-After": "10" };
      return NextResponse.json({ ok: false, error: "Rate limit exceeded" }, { status: 429, headers });
    }
  }
  const MAX_OCC_DELTA = Number(process.env.VIJ_MAX_OCCURRENCE_DELTA || "1000");
  function clampDelta(n?: number): number {
    const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 1;
    return Math.max(1, Math.min(v, MAX_OCC_DELTA));
  }
  try {
    if ("batch" in body && body.batch) {
      let dedupCount = 0;
      const docs: any[] = [];
      for (const l of body.logs) {
        const fp = fingerprint(l.message, l.stack);
        const isNewWindow = DISABLE_DEDUP ? true : await tryDedup(redis, l.appId, fp, DEDUP_WINDOW_MS);
        const delta = clampDelta((l as any).occurrenceDelta);
        await upsertGroup(l.appId, fp, l.message, l.stack, l.severity, l.environment, l.metadata?.tags, delta);
        if (isNewWindow) {
          docs.push({
            appId: l.appId,
            message: l.message,
            stack: l.stack,
            timestamp: l.timestamp ? new Date(l.timestamp) : now,
            severity: l.severity,
            metadata: l.metadata,
            environment: l.environment,
            userAgent: l.userAgent,
            fingerprint: fp,
            tags: Array.isArray((l as any).tags) ? (l as any).tags : Array.isArray(l.metadata?.tags) ? (l.metadata?.tags as string[]) : undefined
          });
          if (!DISABLE_DEDUP) {
            try {
              await redis?.incr("metrics:sample_inserted_total");
              // eslint-disable-next-line no-console
              console.info(JSON.stringify({ src: "vij-admin", event: "sample_inserted", appId: l.appId, fingerprint: fp }));
            } catch {}
          }
        } else {
          dedupCount++;
          if (!DISABLE_DEDUP) {
            try {
              await redis?.incr("metrics:dedup_hits_total");
              // eslint-disable-next-line no-console
              console.info(JSON.stringify({ src: "vij-admin", event: "dedup_hit", appId: l.appId, fingerprint: fp }));
            } catch {}
          }
        }
        try {
          if (delta > 1) {
            await redis?.incrby("metrics:ingested_total", delta);
          } else {
            await redis?.incr("metrics:ingested_total");
          }
        } catch {}
      }
      const inserted = docs.length > 0 ? await LogModel.insertMany(docs, { ordered: false }) : [];
      try {
        broadcastLogs(inserted.map((d: any) => (typeof d.toObject === "function" ? d.toObject() : d)));
      } catch {}
      const headers = { ...corsHeaders } as Record<string, string>;
      if (!DISABLE_DEDUP && dedupCount > 0) {
        headers["x-vij-dedup"] = "1";
        headers["x-vij-sampled"] = "1";
      }
      return NextResponse.json({ ok: true }, { headers });
    } else {
      const l = body as SingleLog;
      let ai_summary: string | null = null;
      let ai_structured: Record<string, unknown> | null = null;
      const fp = fingerprint(l.message, l.stack);
      const isNewWindow = DISABLE_DEDUP ? true : await tryDedup(redis, l.appId, fp, DEDUP_WINDOW_MS);
      const delta = clampDelta((l as any).occurrenceDelta);
      await upsertGroup(l.appId, fp, l.message, l.stack, l.severity, l.environment, l.metadata?.tags, delta);
      let created: any = null;
      if (isNewWindow) {
        if (!DISABLE_DEDUP) {
          try {
            await redis?.incr("metrics:sample_inserted_total");
            // eslint-disable-next-line no-console
            console.info(JSON.stringify({ src: "vij-admin", event: "sample_inserted", appId: l.appId, fingerprint: fp }));
          } catch {}
        }
      try {
        let ai = await AiCacheModel.findOne({ appId: l.appId, fingerprint: fp }).lean();
        if (!ai) {
          const structured = await summarizeErrorStructured({ message: l.message, stack: l.stack, metadata: l.metadata });
          if (structured) {
            ai = { ai: structured } as any;
            await AiCacheModel.updateOne(
              { appId: l.appId, fingerprint: fp },
              { $set: { ai: structured, updatedAt: new Date() } },
              { upsert: true }
            );
          }
        }
        const structured = (ai as any)?.ai;
        if (ai) {
          ai_structured = structured as unknown as Record<string, unknown>;
          ai_summary = structured?.summary ?? null;
        }
      } catch {
        ai_summary = null;
      }
        created = await LogModel.create({
        appId: l.appId,
        message: l.message,
        stack: l.stack,
        timestamp: l.timestamp ? new Date(l.timestamp) : now,
        severity: l.severity,
        metadata: l.metadata,
        environment: l.environment,
        userAgent: l.userAgent,
        ai_summary: ai_summary ?? undefined,
        ai: ai_structured ?? undefined,
        fingerprint: fp,
        tags: Array.isArray((l as any).tags) ? (l as any).tags : Array.isArray(l.metadata?.tags) ? (l.metadata?.tags as string[]) : undefined
      });
      try {
        broadcastLogs(typeof (created as any).toObject === "function" ? (created as any).toObject() : created);
      } catch {}
    }
      try {
        if (delta > 1) {
          await redis?.incrby("metrics:ingested_total", delta);
        } else {
          await redis?.incr("metrics:ingested_total");
        }
        if (!isNewWindow && !DISABLE_DEDUP) {
          await redis?.incr("metrics:dedup_hits_total");
          // eslint-disable-next-line no-console
          console.info(JSON.stringify({ src: "vij-admin", event: "dedup_hit", appId: l.appId, fingerprint: fp }));
        }
      } catch {}
      const headers = { ...corsHeaders } as Record<string, string>;
      if (!DISABLE_DEDUP && !isNewWindow) {
        headers["x-vij-dedup"] = "1";
        headers["x-vij-sampled"] = "1";
      }
      return NextResponse.json({ ok: true }, { headers });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: "DB error" }, { status: 500, headers: corsHeaders });
  }
}

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  await getDb();
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || "20")));
  const appId = searchParams.get("appId") || undefined;
  const severity = searchParams.get("severity") || undefined;
  const environment = searchParams.get("environment") || undefined;
  const search = searchParams.get("search") || undefined;
  const fingerprint = searchParams.get("fingerprint") || undefined;
  const origin = searchParams.get("origin") || undefined; // browser|node
  const from = searchParams.get("from") ? new Date(String(searchParams.get("from"))) : undefined;
  const to = searchParams.get("to") ? new Date(String(searchParams.get("to"))) : undefined;

  const query: Record<string, any> = {};
  if (appId) {
    query.appId = { $regex: escapeRegex(appId), $options: "i" };
  }
  if (severity) query.severity = severity;
  if (environment) query.environment = environment;
  if (from || to) {
    query.timestamp = {};
    if (from) query.timestamp.$gte = from;
    if (to) query.timestamp.$lte = to;
  }
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: "i" };
    query.$or = [{ message: rx }, { stack: rx }];
  }
  if (fingerprint) query.fingerprint = fingerprint;
  if (origin) {
    if (origin === "browser") query["metadata.runtime"] = "browser";
    else if (origin === "node") query["metadata.runtime"] = "node";
  }

  const total = await LogModel.countDocuments(query);
  const data = await LogModel.find(query)
    .sort({ timestamp: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  const hasMore = page * limit < total;

  return NextResponse.json({ data, page, limit, total, hasMore });
}

function fingerprint(message: string, stack?: string) {
  const h = crypto.createHash("md5");
  const sig = stackSignature(stack);
  h.update(`${normalizeMessage(message)}|${sig}`);
  return h.digest("hex");
}

function normalizeMessage(message: string): string {
  return String(message ?? "").trim();
}

function stackSignature(input?: string): string {
  if (!input) return "";
  try {
    const lines = String(input)
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const frames: string[] = [];
    for (const raw of lines) {
      const l = raw;
      // Skip internal/framework frames
      if (/node_modules\//i.test(l) || /next\/dist/i.test(l) || /react-dom/i.test(l) || /webpack/i.test(l)) continue;
      // Chrome style: "at func (url:line:col)" or "at url:line:col"
      let m = l.match(/^at\s+([^\s(]+)\s+\((.+)\)$/);
      if (m && m[1]) {
        frames.push(m[1]);
      } else {
        m = l.match(/^at\s+(.+?):\d+:\d+$/);
        if (m && m[1]) {
          const file = m[1].split(/[\/\\]/).pop() || m[1];
          frames.push(file);
        } else {
          // Safari style: "func@url:line:col"
          m = l.match(/^([^@]+)@(.+):\d+:\d+$/);
          if (m && m[1]) {
            frames.push(m[1]);
          } else {
            // Fallback to last path segment without numbers
            const file = l.replace(/\?.*$/,"").split(/[\/\\]/).pop() || l;
            frames.push(file.replace(/:\d+:\d+$/, ""));
          }
        }
      }
      if (frames.length >= 6) break;
    }
    return frames.join("|");
  } catch {
    return "";
  }
}

async function upsertGroup(
  appId: string,
  fp: string,
  message: string,
  stack: string | undefined,
  severity: string,
  environment: string,
  tags: any,
  delta: number
) {
  const now = new Date();
  const update: any = {
    $setOnInsert: {
      appId,
      fingerprint: fp,
      messageSample: message,
      stackSample: stack,
      severity,
      environment
    },
    $set: { lastSeen: now },
    $inc: { occurrenceCount: Math.max(1, Math.floor(delta)) }
  };
  if (Array.isArray(tags)) {
    update.$addToSet = { ...(update.$addToSet || {}), tags: { $each: tags } };
  }
  const res = await ErrorGroupModel.findOneAndUpdate({ appId, fingerprint: fp }, update, {
    new: true,
    upsert: true
  }).lean();
  return res;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function tryDedup(
  redis: ReturnType<typeof getRedis>,
  appId: string,
  fp: string,
  windowMs: number
): Promise<boolean> {
  if (!redis) return true;
  try {
    const ttlSec = Math.max(1, Math.floor(windowMs / 1000));
    const key = `dedup:${appId}:${fp}`;
    const set = await redis.setnx(key, "1");
    if (set === 1) {
      await redis.expire(key, ttlSec);
      return true;
    }
    return false; 
  } catch {
    return true;
  }
}

