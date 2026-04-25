import { NextResponse } from "next/server"
import { store } from "@/lib/server-store"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const s = store()
  const ep = s.episodes.get(id)
  if (!ep) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({ episode: ep })
}
