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
  const { difficulty, kind, modelUrl, prompt, name, recentSuccessRate } = body ?? {}
  let diff = difficulty
  if (typeof diff !== "number" && typeof recentSuccessRate === "number") {
    const last = Array.from(s.tasks.values()).pop()
    diff = nextDifficulty(last?.difficulty ?? 0.4, recentSuccessRate)
  }
  const task = generateTask({ difficulty: diff, kind, modelUrl, prompt, name })
  s.tasks.set(task.id, task)
  return NextResponse.json({ task })
}
