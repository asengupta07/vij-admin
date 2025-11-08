"use client";
import Filters from "@/components/Filters";
import LogsTable from "@/components/LogsTable";

export default function LogsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold tracking-tight">Logs</h2>
      <Filters />
      <LogsTable />
    </div>
  );
}


