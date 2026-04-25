"use client"
import { useEffect, useRef, useState } from "react"
import { useHabitat } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Hand, Pause, Play, Square, Repeat } from "lucide-react"

export function AutoMode() {
  const policies = useHabitat((s) => s.policies)
  const activePolicyId = useHabitat((s) => s.activePolicyId)
  const setActivePolicy = useHabitat((s) => s.setActivePolicy)
  const runState = useHabitat((s) => s.runState)
  const startRun = useHabitat((s) => s.startRun)
  const pauseRun = useHabitat((s) => s.pauseRun)
  const resumeRun = useHabitat((s) => s.resumeRun)
  const stopRun = useHabitat((s) => s.stopRun)
  const sim = useHabitat((s) => s.sim)
  const deadlock = useHabitat((s) => s.deadlock)
  const intervention = useHabitat((s) => s.intervention)
  const beginIntervention = useHabitat((s) => s.beginIntervention)
  const endIntervention = useHabitat((s) => s.endIntervention)
  const [autoLoop, setAutoLoop] = useState(false)
  const loopRef = useRef(false)
  loopRef.current = autoLoop

  // Auto-restart on completion
  useEffect(() => {
    if (runState === "completed" && loopRef.current) {
      const id = setTimeout(() => {
        const s = useHabitat.getState()
        s.resetRun()
        s.startRun()
      }, 600)
      return () => clearTimeout(id)
    }
  }, [runState])

  const policy = policies.find((p) => p.id === activePolicyId)

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        {runState === "idle" || runState === "completed" ? (
          <Button size="sm" onClick={startRun}>
            <Play className="h-3.5 w-3.5" />
            执行任务
          </Button>
        ) : runState === "running" ? (
          <Button size="sm" variant="secondary" onClick={pauseRun}>
            <Pause className="h-3.5 w-3.5" />
            暂停
          </Button>
        ) : (
          <Button size="sm" onClick={resumeRun}>
            <Play className="h-3.5 w-3.5" />
            继续
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={stopRun} disabled={runState === "idle"}>
          <Square className="h-3.5 w-3.5" />
          停止
        </Button>
        <Button
          size="sm"
          variant={autoLoop ? "accent" : "ghost"}
          onClick={() => setAutoLoop((v) => !v)}
          title="完成后自动重新开始"
        >
          <Repeat className="h-3.5 w-3.5" />
          循环 {autoLoop ? "ON" : "OFF"}
        </Button>
        <Button
          size="sm"
          variant={intervention.active || deadlock.active ? "accent" : "outline"}
          onClick={() => (intervention.active ? endIntervention() : beginIntervention(deadlock.active ? "deadlock" : "user-assist"))}
          disabled={runState !== "running"}
        >
          <Hand className="h-3.5 w-3.5" />
          {intervention.active ? "结束纠错" : deadlock.active ? "纠错建议" : "辅助纠错"}
        </Button>
      </div>

      <div className="rounded-md border border-border bg-card/50 p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">活跃策略</div>
        <div className="mt-1 flex items-center gap-2">
          <select
            value={activePolicyId ?? ""}
            onChange={(e) => setActivePolicy(e.target.value || null)}
            className="h-8 flex-1 rounded-md border border-input bg-secondary/40 px-2 text-sm"
          >
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {policy && <Badge variant="outline">{policy.iterations} iter</Badge>}
        </div>
      </div>

      {sim && (
        <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-card/40 p-3 text-xs tabular">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">奖励</div>
            <div className="text-base text-accent">{sim.totalReward.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">步数</div>
            <div className="text-base">{sim.step}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">能耗</div>
            <div className="text-base">{sim.agent.energyUsed.toFixed(2)}</div>
          </div>
        </div>
      )}

      {deadlock.active && !intervention.active && (
        <div className="rounded-md border border-accent/40 bg-accent/10 p-3 text-xs text-accent">
          reward 已连续 {deadlock.staleSteps} 步无明显提升。可点击“纠错建议”，用手动输入接管若干步并写入示范片段。
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        自动模式：用所选策略闭环执行当前任务。开启循环可批量产 episode，方便对比策略稳健性。
      </p>
    </div>
  )
}
