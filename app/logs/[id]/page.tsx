import { getDb } from "@/lib/mongodb";
import { LogModel, type LogDoc } from "@/models/Log";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatISTDateTime } from "@/lib/time";
import StackViewer from "@/components/StackViewer";

export default async function LogDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getDb();
  const doc = (await LogModel.findById(id).lean()) as LogDoc | null;
  if (!doc) return notFound();
  const t = new Date(doc.timestamp as unknown as string);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Error details</h2>
        <Link href="/logs" className="text-sm text-zinc-600 hover:underline dark:text-zinc-300">
          Back to logs
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-black/10 dark:border-white/10 p-4">
          <div className="text-xs text-zinc-500">App</div>
          <div className="mt-1 font-medium">{doc.appId}</div>
        </div>
        <div className="rounded-lg border border-black/10 dark:border-white/10 p-4">
          <div className="text-xs text-zinc-500">Severity</div>
          <div className="mt-1 font-medium">{doc.severity}</div>
        </div>
        <div className="rounded-lg border border-black/10 dark:border-white/10 p-4">
          <div className="text-xs text-zinc-500">When</div>
          <div className="mt-1 font-medium">{formatISTDateTime(t)}</div>
        </div>
        <div className="rounded-lg border border-black/10 dark:border-white/10 p-4 sm:col-span-3">
          <div className="text-xs text-zinc-500">Origin</div>
          <div className="mt-1 font-medium">
            {(doc.metadata as any)?.runtime === "browser" ? "frontend" : (doc.metadata as any)?.runtime === "node" ? "backend" : "-"}
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-black/10 dark:border-white/10 p-4">
        <div className="text-xs text-zinc-500">Message</div>
        <div className="mt-1 font-medium wrap-break-word">{doc.message}</div>
      </div>
      {doc.stack && <StackViewer stack={String(doc.stack)} />}
      {(doc.ai || doc.ai_summary) && (
        <div className="rounded-lg border border-lime-300/40 dark:border-lime-400/30 p-4 bg-lime-50/50 dark:bg-lime-900/10">
          <div className="mb-2 text-xs font-medium text-lime-700 dark:text-lime-300">AI Analysis</div>
          {doc.ai ? (
            <div className="space-y-2">
              {"summary" in (doc.ai as any) && (
                <p className="text-sm text-lime-800 dark:text-lime-200">{String((doc.ai as any).summary)}</p>
              )}
              {"causes" in (doc.ai as any) && Array.isArray((doc.ai as any).causes) && (
                <div>
                  <div className="text-xs font-medium text-lime-700 dark:text-lime-300">Likely causes</div>
                  <ul className="mt-1 list-disc pl-5 text-sm text-lime-800 dark:text-lime-200">
                    {(doc.ai as any).causes.map((c: string, i: number) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {"fixes" in (doc.ai as any) && Array.isArray((doc.ai as any).fixes) && (
                <div>
                  <div className="text-xs font-medium text-lime-700 dark:text-lime-300">Suggested fixes</div>
                  <ul className="mt-1 list-disc pl-5 text-sm text-lime-800 dark:text-lime-200">
                    {(doc.ai as any).fixes.map((f: string, i: number) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {"tags" in (doc.ai as any) && Array.isArray((doc.ai as any).tags) && (doc.ai as any).tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(doc.ai as any).tags.slice(0, 12).map((t: string, i: number) => (
                    <span key={i} className="rounded border border-lime-400/50 bg-lime-200/40 px-2 py-0.5 text-xs text-lime-900 dark:bg-lime-900/20 dark:text-lime-200">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-lime-800 dark:text-lime-200">{doc.ai_summary}</p>
          )}
        </div>
      )}
      <div className="rounded-lg border border-black/10 dark:border-white/10 p-4">
        <div className="mb-2 text-xs text-zinc-500">Metadata</div>
        {/* eslint-disable-next-line @typescript-eslint/no-var-requires */}
        {require("@/components/MetaCards").default({ metadata: doc.metadata })}
      </div>
    </div>
  );
}


