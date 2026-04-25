"use client"
import { useEffect, useRef, useState } from "react"
import { useHabitat } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Loader2, Play, Square, Wand2 } from "lucide-react"
import { fmt } from "@/lib/utils"
import type { TaskSpec } from "@/lib/types"

type EvalRow = { taskId: string; name: string; difficulty: number; avgReturn: number; successRate: number }

export function CurriculumMode() {
  const tasks = useHabitat((s) => s.tasks)
  const addTask = useHabitat((s) => s.addTask)
  const setActiveTask = useHabitat((s) => s.setActiveTask)
  const activePolicyId = useHabitat((s) => s.activePolicyId)
  const policies = useHabitat((s) => s.policies)
  const upsertPolicy = useHabitat((s) => s.upsertPolicy)
  const episodes = useHabitat((s) => s.episodes)
  const startRun = useHabitat((s) => s.startRun)
  const stopRun = useHabitat((s) => s.stopRun)
  const resetRun = useHabitat((s) => s.resetRun)
  const runState = useHabitat((s) => s.runState)

  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState<"idle" | "generating" | "training" | "evaluating">("idle")
  const [stageMsg, setStageMsg] = useState("")
  const [evalRows, setEvalRows] = useState<EvalRow[] | null>(null)
  const [generalization, setGeneralization] = useState<number | null>(null)
  const [genCount, setGenCount] = useState(3)

  const runRef = useRef(false)

  const policy = policies.find((p) => p.id === activePolicyId)

  // Estimate recent success-rate from last 12 episodes for adaptive difficulty
  const recentSucc = (() => {
    const slice = episodes.slice(0, 12)
    if (slice.length === 0) return 0.5
    return slice.filter((e) => e.success).length / slice.length
  })()

  const generateBatch = async () => {
    setStage("generating")
    setStageMsg(`生成 ${genCount} 个任务，最近成功率 ${(recentSucc * 100).toFixed(0)}%`)
    const newTasks: TaskSpec[] = []
    for (let i = 0; i < genCount; i++) {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recentSuccessRate: recentSucc }),
      }).then((x) => x.json())
      if (r.task) {
        addTask(r.task)
        newTasks.push(r.task)
      }
    }
    return newTasks
  }

  const trainOn = async (taskIds: string[]) => {
    setStage("training")
    setStageMsg(`在 ${taskIds.length} 个任务上训练 ...`)
    const res = await fetch("/api/policies/train", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyId: activePolicyId, taskIds, iterations: 8, populationSize: 14 }),
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
            setStageMsg(`训练 ${evt.iter}/${evt.total} · best=${fmt(evt.best)} · 成功率 ${Math.round(evt.successRate * 100)}%`)
          } else if (evt.type === "done" && evt.policy) {
            upsertPolicy(evt.policy)
          }
        } catch {
          // ignore
        }
      }
    }
  }

  const evaluateAll = async () => {
    setStage("evaluating")
    setStageMsg("跨任务族评估泛化能力 ...")
    const r = await fetch("/api/policies/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyId: activePolicyId, trialsPerTask: 2 }),
    }).then((x) => x.json())
    if (r.result) {
      const rows: EvalRow[] = r.result.perTask.map((p: any) => {
        const t = r.tasks.find((x: any) => x.id === p.taskId)
        return {
          taskId: p.taskId,
          name: t?.name ?? p.taskId,
          difficulty: t?.difficulty ?? 0,
          avgReturn: p.avgReturn,
          successRate: p.successRate,
        }
      })
      setEvalRows(rows)
      setGeneralization(r.result.generalization)
    }
  }

  const runDemoOnFirst = async (newTasks: TaskSpec[]) => {
    if (!newTasks.length) return
    setActiveTask(newTasks[0].id)
    resetRun()
    await new Promise((r) => setTimeout(r, 100))
    startRun()
  }

  const runFullCycle = async () => {
    if (running) return
    runRef.current = true
    setRunning(true)
    try {
      const newTasks = await generateBatch()
      const allIds = [...newTasks.map((t) => t.id)]
      if (allIds.length === 0) return
      await trainOn(allIds)
      if (!runRef.current) return
      await evaluateAll()
      if (!runRef.current) return
      setStage("idle")
      setStageMsg("循环完成")
      runDemoOnFirst(newTasks)
    } finally {
      setRunning(false)
      runRef.current = false
    }
  }

  const stopCycle = () => {
    runRef.current = false
    setRunning(false)
    setStage("idle")
    setStageMsg("已停止")
    if (runState !== "idle") stopRun()
  }

  // Auto-cycle: when a curriculum-driven episode finishes, generate the next task family
  useEffect(() => {
    if (runState !== "completed" || !runRef.current || stage !== "idle") return
    const id = setTimeout(() => {
      runFullCycle()
    }, 800)
    return () => clearTimeout(id)
  }, [runState]) // eslint-disable-line

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {!running ? (
          <Button size="sm" variant="accent" onClick={runFullCycle} disabled={!activePolicyId}>
            <Wand2 className="h-3.5 w-3.5" />
            启动课程
          </Button>
        ) : (
          <Button size="sm" variant="destructive" onClick={stopCycle}>
            <Square className="h-3.5 w-3.5" />
            停止
          </Button>
        )}
        <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          每批生成
          <input
            type="number"
            min={1}
            max={6}
            value={genCount}
            onChange={(e) => setGenCount(Number.parseInt(e.target.value) || 3)}
            className="h-7 w-14 rounded border border-input bg-secondary/40 px-1.5 text-sm"
          />
          个任务
        </label>
        <Badge variant="outline">最近成功率 {(recentSucc * 100).toFixed(0)}%</Badge>
        {policy && <Badge>{policy.name}</Badge>}
      </div>

      <div className="flex items-center gap-2 rounded-md border border-border bg-card/50 p-3 text-xs">
        {stage !== "idle" ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <Play className="h-3.5 w-3.5 text-muted-foreground" />}
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{stage}</div>
          <div className="font-mono">{stageMsg || "等待启动..."}</div>
        </div>
      </div>

      {evalRows && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-card/40 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">泛化评分</span>
            <span className="font-mono text-base text-accent">
              {generalization !== null ? `${(generalization * 100).toFixed(0)}%` : "—"}
            </span>
          </div>
          <Progress value={(generalization ?? 0) * 100} variant="accent" />
          <div className="mt-1 flex flex-col gap-1 text-xs">
            {evalRows.map((row) => (
              <div key={row.taskId} className="flex items-center justify-between rounded border border-border/50 px-2 py-1 font-mono">
                <span className="truncate">{row.name}</span>
                <div className="flex items-center gap-3 tabular">
                  <span className="text-muted-foreground">d={row.difficulty.toFixed(2)}</span>
                  <span className="text-primary">R={fmt(row.avgReturn)}</span>
                  <span className={row.successRate > 0.5 ? "text-emerald-400" : "text-muted-foreground"}>
                    {Math.round(row.successRate * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        课程模式：自动按近期成功率调难度 → 生成新任务 → 训练策略 → 跨任务族评估，形成自演化闭环。
      </p>
    </div>
  )
}
