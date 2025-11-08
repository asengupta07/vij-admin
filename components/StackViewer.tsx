"use client";

export default function StackViewer({ stack }: { stack: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(stack));
      // eslint-disable-next-line no-alert
      alert("Stack copied");
    } catch {
      // ignore
    }
  };

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `Check this error:\n${url}`;
    try {
      await navigator.clipboard.writeText(text);
      // eslint-disable-next-line no-alert
      alert("Share link copied");
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs text-zinc-500">Stack Trace</div>
        <div className="flex gap-2">
          <button
            className="rounded border border-black/20 px-2 py-0.5 text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            onClick={copy}
          >
            Copy
          </button>
          <button
            className="rounded border border-black/20 px-2 py-0.5 text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            onClick={share}
          >
            Share
          </button>
        </div>
      </div>
      <details className="group">
        <summary className="cursor-pointer text-sm text-zinc-700 dark:text-zinc-300">Toggle stack</summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-sm leading-relaxed">{stack}</pre>
      </details>
    </div>
  );
}


