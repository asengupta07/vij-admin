import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
  const redis = getRedis();
  let mongo = "unknown";
  let redisStatus = "disabled";
  try {
    await getDb();
    mongo = "ok";
  } catch {
    mongo = "error";
  }
  if (redis) {
    try {
      const pong = await redis.ping();
      redisStatus = pong === "PONG" ? "ok" : "error";
    } catch {
      redisStatus = "error";
    }
  }
  return NextResponse.json(
    {
      ok: mongo === "ok" && (redisStatus === "ok" || redisStatus === "disabled"),
      mongo,
      redis: redisStatus,
      timestamp: new Date().toISOString()
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Access-Control-Allow-Origin": "*"
      }
    }
  );
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


