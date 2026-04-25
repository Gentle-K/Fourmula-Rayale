import { NextResponse } from "next/server"
import { store } from "@/lib/server-store"
import { hasTripoKey } from "@/lib/tripo"

export async function GET() {
  const s = store()
  return NextResponse.json({
    assets: Array.from(s.assets.values()).sort((a, b) => b.createdAt - a.createdAt),
    tripoReady: hasTripoKey(),
  })
}
