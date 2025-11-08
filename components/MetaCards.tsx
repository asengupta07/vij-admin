type AnyRecord = Record<string, any>;

function Field({ label, value }: { label: string; value: any }) {
  if (value === undefined || value === null || value === "") return null;
  const text =
    typeof value === "string" || typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : JSON.stringify(value);
  return (
    <div className="text-xs">
      <span className="text-zinc-500">{label}: </span>
      <span className="text-zinc-900 dark:text-zinc-100 break-words">{text}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 p-3">
      <div className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export default function MetaCards({ metadata, compact = false }: { metadata?: AnyRecord; compact?: boolean }) {
  if (!metadata || typeof metadata !== "object") return null;
  const runtime = metadata.runtime as string | undefined;
  const isBrowser = runtime === "browser";
  const isNode = runtime === "node";
  const gridCols = compact ? "sm:grid-cols-2" : "sm:grid-cols-3";
  return (
    <div className={`grid grid-cols-1 gap-3 ${gridCols}`}>
      <Card title="SDK">
        <Field label="name" value={metadata.sdk?.name} />
        <Field label="version" value={metadata.sdk?.version} />
        <Field label="runtime" value={runtime} />
      </Card>
      {isBrowser && (
        <>
          <Card title="Page">
            <Field label="url" value={metadata.page?.url} />
            <Field label="referrer" value={metadata.page?.referrer} />
            <Field label="visibility" value={metadata.page?.visibility} />
          </Card>
          <Card title="Browser">
            <Field label="language" value={metadata.browser?.language} />
            <Field label="languages" value={metadata.browser?.languages} />
            <Field label="platform" value={metadata.browser?.platform} />
            <Field label="timeZone" value={metadata.browser?.timeZone} />
            <Field label="userAgent" value={metadata.browser?.userAgent} />
          </Card>
          <Card title="Screen">
            <Field label="width" value={metadata.screen?.width} />
            <Field label="height" value={metadata.screen?.height} />
            <Field label="availWidth" value={metadata.screen?.availWidth} />
            <Field label="availHeight" value={metadata.screen?.availHeight} />
            <Field label="pixelRatio" value={metadata.screen?.pixelRatio} />
          </Card>
          <Card title="Viewport">
            <Field label="innerWidth" value={metadata.viewport?.innerWidth} />
            <Field label="innerHeight" value={metadata.viewport?.innerHeight} />
            <Field label="outerWidth" value={metadata.viewport?.outerWidth} />
            <Field label="outerHeight" value={metadata.viewport?.outerHeight} />
          </Card>
          <Card title="Network">
            <Field label="effectiveType" value={metadata.network?.effectiveType} />
            <Field label="downlink" value={metadata.network?.downlink} />
            <Field label="rtt" value={metadata.network?.rtt} />
            <Field label="saveData" value={metadata.network?.saveData} />
            <Field label="online" value={metadata.online} />
          </Card>
        </>
      )}
      {isNode && (
        <>
          <Card title="Node">
            <Field label="pid" value={metadata.node?.pid} />
            <Field label="ppid" value={metadata.node?.ppid} />
            <Field label="version" value={metadata.node?.version} />
            <Field label="platform" value={metadata.node?.platform} />
            <Field label="arch" value={metadata.node?.arch} />
            <Field label="cwd" value={metadata.node?.cwd} />
            <Field label="uptime" value={metadata.node?.uptime} />
          </Card>
          <Card title="Memory">
            <Field label="rss" value={metadata.node?.memoryUsage?.rss} />
            <Field label="heapTotal" value={metadata.node?.memoryUsage?.heapTotal} />
            <Field label="heapUsed" value={metadata.node?.memoryUsage?.heapUsed} />
            <Field label="external" value={metadata.node?.memoryUsage?.external} />
          </Card>
          <Card title="Env">
            <Field label="NODE_ENV" value={metadata.env?.NODE_ENV} />
          </Card>
        </>
      )}
      <Card title="Error">
        <Field label="name" value={metadata.error?.name} />
        <Field label="message" value={metadata.error?.message} />
        <Field label="cause" value={metadata.error?.cause} />
      </Card>
    </div>
  );
}


