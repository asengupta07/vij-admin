"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = {
  error: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
  unknown: "#9ca3af"
};

export default function SeverityPie({ data }: { data: { _id: string; count: number }[] }) {
  const formatted = data?.length ? data : [{ _id: "unknown", count: 0 }];
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={formatted} dataKey="count" nameKey="_id" outerRadius={80} label>
            {formatted.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={(COLORS as any)[entry._id] ?? COLORS.unknown} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}


