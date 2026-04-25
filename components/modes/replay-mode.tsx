"use client"
import { useEffect } from "react"
import useSWR from "swr"
import { useHabitat } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Play, Pause, Square } from "lucide-react"
import { fmt } from "@/lib/utils"
import type { Episode } from "@/lib/types"

const fetcher = (u: string) => fetch(u).then((r) => r.json())

export function ReplayMode() {
  const episodes = useHabitat((s) => s.episodes)
  const setEpisodes = useHabitat((s) => s.setEpisodes)
  const startReplay = useHabitat((s) => s.startReplay)
  const replayEpisodeId = useHabitat((s) => s.replayEpisodeId)
  const replayIndex = useHabitat((s) => s.replayIndex)
  const runState = useHabitat((s) => s.runState)
  const pauseRun = useHabitat((s) => s.pauseRun)
  const resumeRun = useHabitat((s) => s.resumeRun)
  const stopRun = useHabitat((s) => s.stopRun)

  const { data } = useSWR<{ episodes: Episode[] }>("/api/episodes", fetcher, { refreshInterval: 5000 })
  useEffect(() => {
    if (data?.episodes) {
      // server stores full episodes; merge with client-cached full step data when available
      const map = new Map<string, Episode>(episodes.map((e) => [e.id, e]))
      const merged = data.episodes.map((e) => {
        const local = map.get(e.id)
        return local && local.steps.length > 0 ? local : e
      })
      setEpisodes(merged)
    }
  }, [data]) // eslint-disable-line

  const startReplayLoad = async (id: string) => {
    const local = episodes.find((e) => e.id === id)
    if (local && local.steps.length > 0) {
      startReplay(id)
      return
    }
    const r = await fetch(`/api/episodes/${id}`).then((x) => x.json())
    if (r.episode) {
      const full: Episode = r.episode
      setEpisodes([full, ...episodes.filter((e) => e.id !== id)])
      // ensure store has full episode before starting
      setTimeout(() => startReplay(id), 0)
    }
  }

  const cur = episodes.find((e) => e.id === replayEpisodeId)

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        {runState === "running" ? (
          <Button size="sm" variant="secondary" onClick={pauseRun}>
            <Pause className="h-3.5 w-3.5" />
            暂停
          </Button>
        ) : runState === "paused" ? (
          <Button size="sm" onClick={resumeRun}>
            <Play className="h-3.5 w-3.5" />
            继续
          </Button>
        ) : null}
        {replayEpisodeId && runState !== "idle" && (
          <Button size="sm" variant="outline" onClick={stopRun}>
            <Square className="h-3.5 w-3.5" />
            停止
          </Button>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          {cur ? `第 ${replayIndex} / ${cur.steps.length || cur.durationSteps} 步` : "选择 episode 开始回放"}
        </div>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        {episodes.length === 0 && (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            暂无 episode。先用手动或自动模式运行一次。
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          {episodes.map((e) => (
            <button
              key={e.id}
              onClick={() => startReplayLoad(e.id)}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                e.id === replayEpisodeId ? "border-primary/60 bg-primary/10" : "border-border bg-card hover:bg-secondary"
              }`}
            >
              <div className="flex items-center gap-2">
                <Badge variant={e.success ? "success" : "outline"}>{e.mode}</Badge>
                <div>
                  <div className="font-mono">{e.taskName}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(e.createdAt).toLocaleTimeString()} · {e.durationSteps}步
                  </div>
                </div>
              </div>
              <div className="tabular text-right">
                <div className={e.success ? "text-emerald-400" : "text-muted-foreground"}>
                  R={fmt(e.totalReward)}
                </div>
                <div className="text-[10px] text-muted-foreground">E={fmt(e.energyUsed)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
