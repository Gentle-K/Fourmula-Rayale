import { NextResponse } from "next/server"
import { store } from "@/lib/server-store"
import type { Episode } from "@/lib/types"

export async function GET() {
  const s = store()
  const eps = Array.from(s.episodes.values()).sort((a, b) => b.createdAt - a.createdAt)
  // strip per-step records on list to keep payload small
  const summary = eps.map((e) => ({ ...e, steps: [] }))
  return NextResponse.json({ episodes: summary })
}

export async function POST(req: Request) {
  const s = store()
  const ep = (await req.json()) as Episode
  if (!ep?.id) return NextResponse.json({ error: "invalid episode" }, { status: 400 })
  s.episodes.set(ep.id, ep)
  return NextResponse.json({ ok: true })
}
