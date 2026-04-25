"use client"
import { useEffect } from "react"
import useSWR from "swr"
import { useHabitat } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import type { TaskSpec } from "@/lib/types"

const fetcher = (u: string) => fetch(u).then((r) => r.json())

export function TaskSelector() {
  const tasks = useHabitat((s) => s.tasks)
  const setTasks = useHabitat((s) => s.setTasks)
  const addTask = useHabitat((s) => s.addTask)
  const activeTaskId = useHabitat((s) => s.activeTaskId)
  const setActiveTask = useHabitat((s) => s.setActiveTask)

  const { data } = useSWR<{ tasks: TaskSpec[] }>("/api/tasks", fetcher, { refreshInterval: 6000 })
  useEffect(() => {
    if (data?.tasks) {
      // Merge: prefer client copies for tasks that include modelUrl assigned locally
      const clientById = new Map(tasks.map((t) => [t.id, t]))
      const merged = data.tasks.map((t) => clientById.get(t.id) ?? t)
      // also include tasks created client-side that haven't synced yet
      for (const t of tasks) if (!data.tasks.find((x) => x.id === t.id)) merged.unshift(t)
      setTasks(merged)
    }
  }, [data]) // eslint-disable-line

  const newTask = async () => {
    const r = await fetch("/api/tasks", { method: "POST", body: JSON.stringify({}) }).then((x) => x.json())
    if (r.task) {
      addTask(r.task)
      setActiveTask(r.task.id)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">任务面板</div>
        <Button size="sm" variant="ghost" onClick={newTask} className="h-7 px-2 text-[10px] uppercase">
          <Plus className="h-3 w-3" />
          生成新任务
        </Button>
      </div>
      <div className="flex max-h-44 flex-col gap-1 overflow-auto scrollbar-thin">
        {tasks.length === 0 && <div className="text-xs text-muted-foreground">暂无任务</div>}
        {tasks.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTask(t.id)}
            className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
              t.id === activeTaskId ? "border-primary/60 bg-primary/10" : "border-border bg-card/60 hover:bg-secondary"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: t.target.color }}
              />
              <div className="min-w-0">
                <div className="truncate font-mono">{t.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {t.target.kind} · {t.target.modelUrl ? "GLB" : "primitive"}
                </div>
              </div>
            </div>
            <Badge variant="outline" className="shrink-0">
              d {t.difficulty.toFixed(2)}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  )
}
