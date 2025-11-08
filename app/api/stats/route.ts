import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { LogModel } from "@/models/Log";

export async function GET(_req: NextRequest) {
  await getDb();
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 13); // last 14 days inclusive
  start.setHours(0, 0, 0, 0);

  const [byDay, bySeverity, topMessages, byEnvironment, byOrigin] = await Promise.all([
    LogModel.aggregate([
      { $match: { timestamp: { $gte: start } } },
      {
        $group: {
          _id: {
            y: { $year: "$timestamp" },
            m: { $month: "$timestamp" },
            d: { $dayOfMonth: "$timestamp" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } }
    ]),
    LogModel.aggregate([
      { $group: { _id: "$severity", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    LogModel.aggregate([
      { $group: { _id: "$message", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]),
    LogModel.aggregate([
      { $group: { _id: "$environment", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    LogModel.aggregate([
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$metadata.runtime", "browser"] },
              "frontend",
              {
                $cond: [{ $eq: ["$metadata.runtime", "node"] }, "backend", "unknown"]
              }
            ]
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ])
  ]);

  return NextResponse.json({
    byDay,
    bySeverity,
    topMessages,
    byEnvironment,
    byOrigin
  });
}


