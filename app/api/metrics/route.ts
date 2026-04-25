import { NextResponse } from "next/server"
import { store } from "@/lib/server-store"

export async function GET() {
  const s = store()
  const eps = Array.from(s.episodes.values()).sort((a, b) => a.createdAt - b.createdAt)
  const total = eps.length
  const success = eps.filter((e) => e.success).length
  const avgReturn = total ? eps.reduce((a, b) => a + b.totalReward, 0) / total : 0
  const avgEnergy = total ? eps.reduce((a, b) => a + b.energyUsed, 0) / total : 0
  const last20 = eps.slice(-20)
  const last20Success = last20.length ? last20.filter((e) => e.success).length / last20.length : 0

  // group by mode
  const byMode: Record<string, { total: number; success: number; avgReturn: number }> = {}
  for (const e of eps) {
    const m = (byMode[e.mode] ||= { total: 0, success: 0, avgReturn: 0 })
    m.total += 1
    if (e.success) m.success += 1
    m.avgReturn += e.totalReward
  }
  for (const k of Object.keys(byMode)) {
    byMode[k].avgReturn = byMode[k].avgReturn / Math.max(1, byMode[k].total)
  }

  // per-task counts for generalization
  const byTask: Record<string, { name: string; total: number; success: number; difficulty: number }> = {}
  for (const e of eps) {
    const t = s.tasks.get(e.taskId)
    const row = (byTask[e.taskId] ||= {
      name: e.taskName,
      total: 0,
      success: 0,
      difficulty: t?.difficulty ?? 0,
    })
    row.total += 1
    if (e.success) row.success += 1
  }

  // training-curve-like series: rolling success-rate vs episode index
  const series = eps.map((e, i) => {
    const window = eps.slice(Math.max(0, i - 9), i + 1)
    const win = window.length
    const succ = window.filter((x) => x.success).length / Math.max(1, win)
    return {
      i: i + 1,
      reward: e.totalReward,
      successRate: succ,
      energy: e.energyUsed,
    }
  })

  return NextResponse.json({
    total,
    success,
    successRate: total ? success / total : 0,
    avgReturn,
    avgEnergy,
    last20Success,
    byMode,
    byTask,
    series,
    taskCount: s.tasks.size,
    policyCount: s.policies.size,
    assetCount: s.assets.size,
  })
}
