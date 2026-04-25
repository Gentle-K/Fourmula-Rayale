"use client"

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-foreground">
      <div className="font-mono text-xs uppercase tracking-[0.3em] text-destructive">runtime error</div>
      <h1 className="text-2xl font-semibold tracking-tight">仿真出错</h1>
      <p className="max-w-md text-center font-mono text-xs text-muted-foreground">
        {error.message || "未知错误"}
      </p>
      <button
        onClick={reset}
        className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary"
      >
        重新加载
      </button>
    </main>
  )
}
