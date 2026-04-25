import { store, subscribeAsset } from "@/lib/server-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const s = store()

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      const send = (chunk: string) => {
        try {
          controller.enqueue(enc.encode(chunk))
        } catch {
          // ignore
        }
      }

      // Initial snapshot
      const a = s.assets.get(id)
      if (a) {
        send(
          `data: ${JSON.stringify({
            type: a.status === "succeeded" ? "completed" : a.status === "failed" ? "failed" : "progress",
            assetId: a.id,
            progress: a.progress,
            status: a.status,
            modelUrl: a.modelUrl,
            thumbnailUrl: a.thumbnailUrl,
            error: a.error,
          })}\n\n`,
        )
      } else {
        send(`data: ${JSON.stringify({ type: "failed", assetId: id, error: "asset not found" })}\n\n`)
        controller.close()
        return
      }

      if (a.status === "succeeded" || a.status === "failed") {
        controller.close()
        return
      }

      const unsub = subscribeAsset(id, (chunk) => {
        send(chunk)
        // close on terminal
        if (chunk.includes("\"type\":\"completed\"") || chunk.includes("\"type\":\"failed\"")) {
          unsub()
          try {
            controller.close()
          } catch {
            // ignore
          }
        }
      })

      // safety timeout 10 min
      const to = setTimeout(() => {
        unsub()
        try {
          controller.close()
        } catch {
          // ignore
        }
      }, 10 * 60 * 1000)

      // cleanup on cancel via the stream close path is implicit
      ;(controller as any)._cleanup = () => {
        clearTimeout(to)
        unsub()
      }
    },
    cancel(reason) {
      // Best effort cleanup; subscribeAsset handles it on terminal events too.
      void reason
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
