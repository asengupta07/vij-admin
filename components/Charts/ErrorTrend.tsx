"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from "recharts";

type Point = { _id: { y: number; m: number; d: number }; count: number };

export default function ErrorTrend({ data }: { data: Point[] }) {
  const formatted = data.map((p) => {
    const date = new Date(p._id.y, p._id.m - 1, p._id.d);
    return { date: date.toISOString().slice(0, 10), count: p.count };
  });
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis dataKey="date" tickMargin={8} />
          <YAxis allowDecimals={false} width={40} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}


