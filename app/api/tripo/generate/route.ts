import { NextResponse } from "next/server"
import { store, emitAssetEvent } from "@/lib/server-store"
import { createTextToModelTask, getTaskStatus, extractModelUrl, extractThumbnail, isTerminal, hasTripoKey } from "@/lib/tripo"
import type { AssetItem, TargetKind } from "@/lib/types"
import { shortId } from "@/lib/utils"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(req: Request) {
  const s = store()
  const body = await req.json().catch(() => ({}))
  const prompt: string = (body.prompt ?? "").trim()
  const kind: TargetKind = body.kind ?? "custom"
  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 })
  if (!hasTripoKey()) return NextResponse.json({ error: "TRIPO_API_KEY not set" }, { status: 503 })

  const asset: AssetItem = {
    id: "asset_" + shortId(),
    prompt,
    status: "queued",
    progress: 0,
    createdAt: Date.now(),
    kind,
  }
  s.assets.set(asset.id, asset)

  // Kick off the Tripo task asynchronously
  ;(async () => {
    try {
      const taskId = await createTextToModelTask(prompt)
      asset.taskId = taskId
      asset.status = "running"
      asset.progress = 0.05
      s.assets.set(asset.id, asset)
      emitAssetEvent(asset.id, { type: "progress", assetId: asset.id, progress: 0.05, status: "running" })

      const start = Date.now()
      while (Date.now() - start < 8 * 60 * 1000) {
        await new Promise((r) => setTimeout(r, 4000))
        try {
          const data = await getTaskStatus(taskId)
          const t = isTerminal(data.status)
          const prog = typeof data.progress === "number" ? Math.max(asset.progress, data.progress / 100) : asset.progress + 0.04
          asset.progress = Math.min(0.95, prog)
          asset.status = "running"
          s.assets.set(asset.id, asset)
          emitAssetEvent(asset.id, {
            type: "progress",
            assetId: asset.id,
            progress: asset.progress,
            status: data.status,
          })

          if (t === "success") {
            const modelUrl = extractModelUrl(data)
            const thumbnailUrl = extractThumbnail(data)
            if (!modelUrl) throw new Error("no model URL in result")
            asset.status = "succeeded"
            asset.progress = 1
            asset.modelUrl = modelUrl
            asset.thumbnailUrl = thumbnailUrl
            s.assets.set(asset.id, asset)
            emitAssetEvent(asset.id, {
              type: "completed",
              assetId: asset.id,
              modelUrl,
              thumbnailUrl,
            })
            return
          }
          if (t === "failed") {
            throw new Error(data.error_msg ?? `task ${data.status}`)
          }
        } catch (innerErr: any) {
          // transient: keep polling but emit warning
          emitAssetEvent(asset.id, {
            type: "progress",
            assetId: asset.id,
            progress: asset.progress,
            status: "polling",
          })
          // eslint-disable-next-line no-console
          console.log("[v0] tripo poll error:", innerErr?.message)
        }
      }
      throw new Error("Tripo task timed out")
    } catch (err: any) {
      asset.status = "failed"
      asset.error = err?.message ?? "generation failed"
      s.assets.set(asset.id, asset)
      emitAssetEvent(asset.id, { type: "failed", assetId: asset.id, error: asset.error })
    }
  })().catch(() => {})

  return NextResponse.json({ asset })
}

export async function GET() {
  const s = store()
  return NextResponse.json({
    assets: Array.from(s.assets.values()).sort((a, b) => b.createdAt - a.createdAt),
  })
}
