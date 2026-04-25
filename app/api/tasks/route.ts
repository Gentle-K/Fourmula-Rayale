import { NextResponse } from "next/server"
import { store } from "@/lib/server-store"
import { generateTask, nextDifficulty } from "@/lib/curriculum"

export async function GET() {
  const s = store()
  return NextResponse.json({ tasks: Array.from(s.tasks.values()).sort((a, b) => b.createdAt - a.createdAt) })
}

export async function POST(req: Request) {
  const s = store()
  const body = await req.json().catch(() => ({}))
  const {
    difficulty,
    kind,
    modelUrl,
    prompt,
    name,
    recentSuccessRate,
    taskPreset,
    initial,
    goal,
    assetId,
  } = body ?? {}
  const asset = typeof assetId === "string" ? s.assets.get(assetId) : null
  let diff = difficulty
  if (typeof diff !== "number" && typeof recentSuccessRate === "number") {
    const last = Array.from(s.tasks.values()).pop()
    diff = nextDifficulty(last?.difficulty ?? 0.4, recentSuccessRate)
  }
  const task = generateTask({
    difficulty: diff,
    kind: kind ?? asset?.kind,
    modelUrl: modelUrl ?? asset?.modelUrl,
    prompt: prompt ?? asset?.prompt,
    name: name ?? asset?.prompt?.slice(0, 18),
    taskPreset,
    initial,
    goal,
  })
  s.tasks.set(task.id, task)
  return NextResponse.json({ task })
}
