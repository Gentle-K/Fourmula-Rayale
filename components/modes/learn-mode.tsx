"use client"
import { useState } from "react"
import { useHabitat } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { fmt } from "@/lib/utils"
import { Brain, Loader2, Sparkles } from "lucide-react"
import type { Policy } from "@/lib/types"

type Update = { iter: number; total: number; eliteAvg: number; best: number; successRate: number }

export function LearnMode() {
  const policies = useHabitat((s) => s.policies)
  const upsertPolicy = useHabitat((s) => s.upsertPolicy)
  const activePolicyId = useHabitat((s) => s.activePolicyId)
  const setActivePolicy = useHabitat((s) => s.setActivePolicy)
  const tasks = useHabitat((s) => s.tasks)
  const activeTaskId = useHabitat((s) => s.activeTaskId)

  const [training, setTraining] = useState(false)
  const [history, setHistory] = useState<Update[]>([])
  const [iterations, setIterations] = useState(12)
  const [population, setPopulation] = useState(16)
  const [taskMode, setTaskMode] = useState<"current" | "all">("current")

  const activePolicy = policies.find((p) => p.id === activePolicyId)

  const runTrain = async () => {
    if (training) return
    setTraining(true)
    setHistory([])
    const taskIds =
      taskMode === "current" && activeTaskId ? [activeTaskId] : tasks.slice(0, 4).map((t) => t.id)
    try {
      const res = await fetch("/api/policies/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyId: activePolicyId,
          taskIds,
          iterations,
          populationSize: population,
        }),
      })
      const reader = res.body?.getReader()
      const dec = new TextDecoder()
      let buf = ""
      while (reader) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split("\n\n")
        buf = parts.pop() ?? ""
        for (const part of parts) {
          const line = part.replace(/^data:\s*/, "").trim()
          if (!line) continue
          try {
            const evt = JSON.parse(line)
            if (evt.type === "iter") {
              const u: Update = {
                iter: evt.iter,
                total: evt.total,
                eliteAvg: evt.eliteAvg,
                best: evt.best,
                successRate: evt.successRate,
              }
              setHistory((h) => [...h, u])
            } else if (evt.type === "done" && evt.policy) {
              const p = evt.policy as Policy
              upsertPolicy(p)
              setActivePolicy(p.id)
            } else if (evt.type === "error") {
              console.log("[v0] train error:", evt.error)
            }
          } catch {
            // ignore
          }
        }
      }
    } finally {
      setTraining(false)
    }
  }

  const newPolicy = async () => {
    const r = await fetch("/api/policies", { method: "POST", body: JSON.stringify({}) })
    const j = await r.json()
    if (j.policy) {
      upsertPolicy(j.policy)
      setActivePolicy(j.policy.id)
    }
  }

  const last = history[history.length - 1]

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={runTrain} disabled={training} variant="accent">
          {training ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {training ? "训练中..." : "开始训练 (CEM)"}
        </Button>
        <Button size="sm" variant="outline" onClick={newPolicy} disabled={training}>
          <Brain className="h-3.5 w-3.5" />
          新建策略
        </Button>
        <div className="ml-auto flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <button
            onClick={() => setTaskMode("current")}
            className={`rounded px-2 py-0.5 ${taskMode === "current" ? "bg-secondary text-foreground" : ""}`}
          >
            当前任务
          </button>
          <button
            onClick={() => setTaskMode("all")}
            className={`rounded px-2 py-0.5 ${taskMode === "all" ? "bg-secondary text-foreground" : ""}`}
          >
            任务族
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          迭代数
          <input
            type="number"
            min={2}
            max={40}
            value={iterations}
            onChange={(e) => setIterations(Number.parseInt(e.target.value) || 12)}
            className="h-8 rounded-md border border-input bg-secondary/40 px-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          种群大小
          <input
            type="number"
            min={4}
            max={48}
            value={population}
            onChange={(e) => setPopulation(Number.parseInt(e.target.value) || 16)}
            className="h-8 rounded-md border border-input bg-secondary/40 px-2 text-sm"
          />
        </label>
        <div className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          活跃策略
          <select
            value={activePolicyId ?? ""}
            onChange={(e) => setActivePolicy(e.target.value || null)}
            className="h-8 rounded-md border border-input bg-secondary/40 px-2 text-sm"
          >
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {last && (
        <div className="flex items-center gap-3 rounded-md border border-border bg-card/50 p-3 text-xs">
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">迭代</div>
            <div className="font-mono text-base">
              {last.iter} / {last.total}
            </div>
            <Progress value={(last.iter / last.total) * 100} className="mt-1.5" variant="accent" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">精英均值</div>
            <div className="tabular text-base text-primary">{fmt(last.eliteAvg)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">最佳回报</div>
            <div className="tabular text-base text-accent">{fmt(last.best)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">成功率</div>
            <div className="tabular text-base">{Math.round(last.successRate * 100)}%</div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto scrollbar-thin">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">策略列表</div>
        <div className="mt-1.5 flex flex-col gap-1.5">
          {policies.map((p) => (
            <button
              key={p.id}
              onClick={() => setActivePolicy(p.id)}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs ${
                p.id === activePolicyId ? "border-primary/60 bg-primary/10" : "border-border bg-card"
              }`}
            >
              <div className="flex items-center gap-2">
                <Badge>{p.iterations}iter</Badge>
                <div className="font-mono">{p.name}</div>
              </div>
              <div className="tabular text-muted-foreground">
                best={fmt(p.bestReturn)} · avg={fmt(p.avgReturn)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {activePolicy && (
        <div className="rounded-md border border-border bg-card/40 p-2 font-mono text-[10px] text-muted-foreground">
          训练任务族: {activePolicy.taskFamily.length || "—"} 个任务 · 上次更新{" "}
          {new Date(activePolicy.updatedAt).toLocaleTimeString()}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        学习模式使用 CEM (交叉熵法) 在所选任务上滚动评估线性策略，每轮保留精英样本拟合新分布。SSE 流实时更新进度。
      </p>
    </div>
  )
}
