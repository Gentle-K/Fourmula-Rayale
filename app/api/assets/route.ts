import { NextResponse } from "next/server"
import { store } from "@/lib/server-store"

export async function GET() {
  const s = store()
  return NextResponse.json({
    assets: Array.from(s.assets.values()).sort((a, b) => b.createdAt - a.createdAt),
  })
}
