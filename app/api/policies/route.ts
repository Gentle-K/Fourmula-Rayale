import { NextResponse } from "next/server"
import { store } from "@/lib/server-store"
import { emptyPolicy } from "@/lib/policy"
import type { Policy } from "@/lib/types"

export async function GET() {
  const s = store()
  return NextResponse.json({
    policies: Array.from(s.policies.values()).sort((a, b) => b.updatedAt - a.updatedAt),
  })
}

export async function POST(req: Request) {
  const s = store()
  const body = await req.json().catch(() => ({}))
  if (body?.policy?.id) {
    const p = body.policy as Policy
    s.policies.set(p.id, p)
    return NextResponse.json({ policy: p })
  }
  const p = emptyPolicy(body?.name ?? undefined)
  s.policies.set(p.id, p)
  return NextResponse.json({ policy: p })
}
