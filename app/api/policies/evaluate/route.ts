import { NextResponse } from "next/server"
import { store } from "@/lib/server-store"
import { evaluateOnTaskFamily } from "@/lib/policy"
import type { TaskSpec } from "@/lib/types"

export async function POST(req: Request) {
  const s = store()
  const body = await req.json().catch(() => ({}))
  const policyId: string = body.policyId
  const taskIds: string[] | undefined = body.taskIds
  const policy = s.policies.get(policyId)
  if (!policy) return NextResponse.json({ error: "policy not found" }, { status: 404 })
  const tasks: TaskSpec[] = (taskIds && taskIds.length
    ? taskIds.map((id) => s.tasks.get(id)).filter(Boolean)
    : Array.from(s.tasks.values())) as TaskSpec[]
  const result = evaluateOnTaskFamily(policy, tasks, body.trialsPerTask ?? 2)
  return NextResponse.json({
    result,
    tasks: tasks.map((t) => ({ id: t.id, name: t.name, difficulty: t.difficulty })),
  })
}
