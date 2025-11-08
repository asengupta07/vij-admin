import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  const redis = getRedis();
  const headers = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Access-Control-Allow-Origin": "*"
  };
  const base = {
    ingested_total: 0,
    dedup_hits_total: 0,
    sample_inserted_total: 0,
    rate_limit_total: 0,
    backoff_advised_total: 0,
    redis: redis ? "enabled" : "disabled",
    mongo: "unknown"
  };
  try {
    await getDb();
    base.mongo = "ok";
  } catch {
    base.mongo = "error";
  }
  if (!redis) {
    return NextResponse.json(base, { headers });
  }
  try {
    const keys = [
      "metrics:ingested_total",
      "metrics:dedup_hits_total",
      "metrics:sample_inserted_total",
      "metrics:rate_limit_total",
      "metrics:backoff_advised_total"
    ];
    const values = await redis.mget(keys);
    return NextResponse.json(
      {
        ...base,
        ingested_total: Number(values?.[0] || 0),
        dedup_hits_total: Number(values?.[1] || 0),
        sample_inserted_total: Number(values?.[2] || 0),
        rate_limit_total: Number(values?.[3] || 0),
        backoff_advised_total: Number(values?.[4] || 0)
      },
      { headers }
    );
  } catch {
    return NextResponse.json(base, { headers });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}


