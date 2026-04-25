import Link from "next/link"

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-foreground">
      <div className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">404</div>
      <h1 className="text-2xl font-semibold tracking-tight">未找到页面</h1>
      <p className="text-sm text-muted-foreground">该路径不存在于 Orbital Skill Habitat 中。</p>
      <Link
        href="/"
        className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary"
      >
        返回主控台
      </Link>
    </main>
  )
}
