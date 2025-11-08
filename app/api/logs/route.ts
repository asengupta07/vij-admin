import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { LogModel } from "@/models/Log";
import { summarizeErrorStructured } from "@/lib/ai";
import crypto from "node:crypto";
import { ErrorGroupModel } from "@/models/ErrorGroup";
import { AiCacheModel } from "@/models/AiCache";
import { broadcastLogs } from "@/lib/ws";

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
  userAgent: z.string().optional()
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
  try {
    if ("batch" in body && body.batch) {
      const docs = await Promise.all(
        body.logs.map(async (l: SingleLog) => {
          const fp = fingerprint(l.message, l.stack);
          const group = await upsertGroup(l.appId, fp, l.message, l.stack, l.severity, l.environment, l.metadata?.tags);
          const groupId = (group as unknown as { _id?: unknown } | null)?._id;
          return {
            appId: l.appId,
            message: l.message,
            stack: l.stack,
            timestamp: l.timestamp ? new Date(l.timestamp) : now,
            severity: l.severity,
            metadata: l.metadata,
            environment: l.environment,
            userAgent: l.userAgent,
            fingerprint: fp,
            groupId: groupId as any,
            tags: Array.isArray((l as any).tags) ? (l as any).tags : Array.isArray(l.metadata?.tags) ? (l.metadata?.tags as string[]) : undefined
          };
        })
      );
      const inserted = await LogModel.insertMany(docs, { ordered: false });
      try {
        broadcastLogs(inserted.map((d: any) => (typeof d.toObject === "function" ? d.toObject() : d)));
      } catch {}
    } else {
      const l = body as SingleLog;
      let ai_summary: string | null = null;
      let ai_structured: Record<string, unknown> | null = null;
      const fp = fingerprint(l.message, l.stack);
      await upsertGroup(l.appId, fp, l.message, l.stack, l.severity, l.environment, l.metadata?.tags);
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
      const created = await LogModel.create({
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
    return NextResponse.json({ ok: true }, { headers: corsHeaders });
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
  h.update(`${message}|${stack ?? ""}`);
  return h.digest("hex");
}

async function upsertGroup(
  appId: string,
  fp: string,
  message: string,
  stack: string | undefined,
  severity: string,
  environment: string,
  tags: any
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
    $inc: { occurrenceCount: 1 }
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

