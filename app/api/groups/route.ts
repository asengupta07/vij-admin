import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ErrorGroupModel } from "@/models/ErrorGroup";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  await getDb();
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || "20")));
  const appId = searchParams.get("appId") || undefined;
  const severity = searchParams.get("severity") || undefined;
  const environment = searchParams.get("environment") || undefined;

  const query: Record<string, any> = {};
  if (appId) query.appId = appId;
  if (severity) query.severity = severity;
  if (environment) query.environment = environment;

  const total = await ErrorGroupModel.countDocuments(query);
  const data = await ErrorGroupModel.find(query)
    .sort({ lastSeen: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  const hasMore = page * limit < total;
  return NextResponse.json({ data, page, limit, total, hasMore });
}


