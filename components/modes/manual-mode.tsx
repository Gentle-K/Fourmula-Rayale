"use client"
import { useEffect } from "react"
import { useHabitat } from "@/lib/store"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Pause, Play, RotateCcw, Square } from "lucide-react"

export function ManualMode() {
  const manual = useHabitat((s) => s.manualInput)
  const setManual = useHabitat((s) => s.setManual)
  const runState = useHabitat((s) => s.runState)
  const startRun = useHabitat((s) => s.startRun)
  const pauseRun = useHabitat((s) => s.pauseRun)
  const resumeRun = useHabitat((s) => s.resumeRun)
  const stopRun = useHabitat((s) => s.stopRun)
  const resetRun = useHabitat((s) => s.resetRun)

  // Keyboard hints (decay manual input slightly when keys released)
  useEffect(() => {
    const decay = setInterval(() => {
      const s = useHabitat.getState()
      if (s.runState !== "running") return
      const m = s.manualInput
      // gentle return to neutral on continuous-axis controls
      s.setManual({
        base: m.base * 0.85,
        shoulder: m.shoulder * 0.85,
        elbow: m.elbow * 0.85,
        wrist: m.wrist * 0.85,
        thrust: m.thrust * 0.85,
      })
    }, 80)
    return () => clearInterval(decay)
  }, [])

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        {runState === "idle" || runState === "completed" ? (
          <Button size="sm" onClick={startRun}>
            <Play className="h-3.5 w-3.5" />
            启动
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
          结束并记录
        </Button>
        <Button size="sm" variant="ghost" onClick={resetRun}>
          <RotateCcw className="h-3.5 w-3.5" />
          重置
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-card/50 p-3">
        <Slider label="底座旋转" value={manual.base} onChange={(v) => setManual({ base: v })} />
        <Slider label="肩部" value={manual.shoulder} onChange={(v) => setManual({ shoulder: v })} />
        <Slider label="肘部" value={manual.elbow} onChange={(v) => setManual({ elbow: v })} />
        <Slider label="腕部" value={manual.wrist} onChange={(v) => setManual({ wrist: v })} />
        <Slider
          label="夹爪"
          value={manual.grip}
          min={0}
          max={1}
          bipolar={false}
          onChange={(v) => setManual({ grip: v })}
        />
        <Slider label="微推力" value={manual.thrust} onChange={(v) => setManual({ thrust: v })} />
      </div>

      <p className="text-xs text-muted-foreground">
        手动模式：拖动滑块直接驱动 6-DOF 关节。运行结束时本次轨迹会作为 episode 落库，可用于回放或后续训练。
      </p>
    </div>
  )
}
