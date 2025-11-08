"use client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = {
  frontend: "#0ea5e9",
  backend: "#14b8a6",
  unknown: "#9ca3af"
};

export default function OriginPie({ data }: { data: { _id: string; count: number }[] }) {
  const formatted = data?.length ? data : [{ _id: "unknown", count: 0 }];
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={formatted} dataKey="count" nameKey="_id" outerRadius={64}>
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


