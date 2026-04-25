"use client"
import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { useHabitat } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/input"
import { Loader2, Sparkles, Box, AlertCircle } from "lucide-react"
import type { AssetItem, TargetKind } from "@/lib/types"

const fetcher = (u: string) => fetch(u).then((r) => r.json())

const PRESETS: { kind: TargetKind; prompt: string; label: string }[] = [
  {
    kind: "panel",
    prompt: "白色金属航天器维修面板，带蓝色LED指示灯，低多边形，PBR材质",
    label: "维修面板",
  },
  {
    kind: "tool",
    prompt: "便携式航天器扳手，金属机身，橙色把手，工业风格，低多边形",
    label: "维修扳手",
  },
  {
    kind: "module",
    prompt: "立方形航天器实验载荷模块，金属外壳，散热鳍片，标识贴纸",
    label: "载荷模块",
  },
  {
    kind: "prop",
    prompt: "low-poly space water cup with removable cap, white polymer body, blue gasket, PBR material",
    label: "水杯开盖",
  },
  {
    kind: "robot",
    prompt: "modular friendly space maintenance robot shell, separated armor plates, white and cyan, lightweight humanoid proportions, PBR",
    label: "机器人外观",
  },
]

export function GenerationPanel() {
  const assets = useHabitat((s) => s.assets)
  const setAssets = useHabitat((s) => s.setAssets)
  const upsertAsset = useHabitat((s) => s.upsertAsset)
  const applyRobotAsset = useHabitat((s) => s.applyRobotAsset)
  const insertAssetAsTask = useHabitat((s) => s.insertAssetAsTask)

  const [prompt, setPrompt] = useState(PRESETS[0].prompt)
  const [kind, setKind] = useState<TargetKind>("panel")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data } = useSWR<{ assets: AssetItem[]; tripoReady: boolean }>("/api/assets", fetcher, { refreshInterval: 8000 })
  useEffect(() => {
    if (data?.assets) setAssets(data.assets)
  }, [data]) // eslint-disable-line

  const submit = async () => {
    if (!prompt.trim() || submitting) return
    if (data && !data.tripoReady) {
      setError("TRIPO_API_KEY 未配置。当前设置为真实 Tripo3D 模式，不能使用本地假模型兜底。")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const r = await fetch("/api/tripo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, kind }),
      })
      const j = await r.json()
      if (!r.ok) {
        setError(j.error ?? "Tripo3D 提交失败")
        return
      }
      if (j.asset) {
        upsertAsset(j.asset)
        subscribe(j.asset.id)
      }
    } catch (e) {
      console.log("[v0] generation failed:", e)
      setError("Tripo3D 请求失败")
    } finally {
      setSubmitting(false)
    }
  }

  const subscribe = (assetId: string) => {
    const es = new EventSource(`/api/tripo/stream/${assetId}`)
    es.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data)
        const cur = useHabitat.getState().assets.find((a) => a.id === assetId)
        if (!cur) return
        if (d.type === "progress") {
          upsertAsset({ ...cur, progress: d.progress ?? cur.progress, status: "running" })
        } else if (d.type === "completed") {
          upsertAsset({
            ...cur,
            status: "succeeded",
            progress: 1,
            modelUrl: d.modelUrl,
            thumbnailUrl: d.thumbnailUrl,
          })
          es.close()
        } else if (d.type === "failed") {
          upsertAsset({ ...cur, status: "failed", error: d.error })
          es.close()
        }
      } catch {
        // ignore
      }
    }
    es.onerror = () => es.close()
  }

  // Subscribe to any in-progress assets on mount
  const subbed = useRef<Set<string>>(new Set())
  useEffect(() => {
    for (const a of assets) {
      if ((a.status === "running" || a.status === "queued") && !subbed.current.has(a.id)) {
        subbed.current.add(a.id)
        subscribe(a.id)
      }
    }
  }, [assets]) // eslint-disable-line

  const useAsTask = async (a: AssetItem) => {
    if (!a.modelUrl) return
    if (a.kind === "robot") {
      applyRobotAsset(a.id)
      return
    }
    await insertAssetAsTask(a.id, a.kind === "prop" ? "open-cap" : "dock")
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-col gap-2">
        <Textarea
          rows={3}
          placeholder="描述要生成的航天器物体（中文/英文皆可）..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="resize-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as TargetKind)}
            className="h-8 rounded-md border border-input bg-secondary/40 px-2 text-xs"
          >
            <option value="panel">面板</option>
            <option value="tool">工具</option>
            <option value="module">模块</option>
            <option value="prop">训练物品</option>
            <option value="robot">机器人外观</option>
            <option value="custom">自定义</option>
          </select>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                setPrompt(p.prompt)
                setKind(p.kind)
              }}
              className="rounded-md border border-border px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:bg-secondary"
            >
              {p.label}
            </button>
          ))}
          <Button size="sm" variant="accent" onClick={submit} disabled={submitting} className="ml-auto">
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            提交生成
          </Button>
        </div>
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
        {data && !data.tripoReady && (
          <div className="rounded-md border border-accent/40 bg-accent/10 px-2.5 py-2 text-xs text-accent">
            真实 Tripo3D 模式需要服务端配置 TRIPO_API_KEY；未配置时不会生成本地假资产。
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">资产库</div>
        {assets.length === 0 ? (
          <div className="mt-3 rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            暂无生成任务。提交一个 prompt 即可。
          </div>
        ) : (
          <div className="mt-1.5 flex flex-col gap-1.5">
            {assets.map((a) => (
              <div key={a.id} className="rounded-md border border-border bg-card p-2.5 text-xs">
                <div className="flex items-start gap-2">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-secondary/50">
                    {a.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.thumbnailUrl} alt={a.prompt} className="h-full w-full object-cover" />
                    ) : (
                      <Box className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={
                          a.status === "succeeded"
                            ? "success"
                            : a.status === "failed"
                              ? "destructive"
                              : "default"
                        }
                      >
                        {a.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{a.kind}</span>
                    </div>
                    <div className="mt-1 line-clamp-2 break-words font-mono text-[11px] text-foreground/90">
                      {a.prompt}
                    </div>
                    {a.status === "failed" && a.error && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        {a.error}
                      </div>
                    )}
                    {(a.status === "running" || a.status === "queued") && (
                      <Progress className="mt-1.5" value={a.progress * 100} variant="accent" />
                    )}
                  </div>
                </div>
                {a.status === "succeeded" && (
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => useAsTask(a)}>
                      {a.kind === "robot" ? "应用机器人外观" : "插入场景训练"}
                    </Button>
                    <a
                      href={a.modelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-primary hover:underline"
                    >
                      下载 GLB
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Tripo3D text-to-model 真实接口。生成完成的 GLB 可直接挂入仿真，作为新的训练目标。
      </p>
    </div>
  )
}
