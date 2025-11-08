"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function TopMessagesBar({ data }: { data: { _id: string; count: number }[] }) {
  const formatted = data.map((d) => ({ label: d._id?.slice(0, 40) ?? "unknown", count: d.count }));
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted} margin={{ left: 12 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={0} height={36} />
          <YAxis allowDecimals={false} width={32} />
          <Tooltip />
          <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}


