import type { TargetSpec, TaskSpec, Vec3 } from "./types"
import { shortId } from "./utils"

const KIND_NAMES: Record<TargetSpec["kind"], string[]> = {
  panel: ["散热面板", "太阳能板", "维修面板", "导航面板"],
  tool: ["扳手", "焊枪", "传感器", "维修工具"],
  module: ["实验舱模块", "电池模块", "对接模块", "通讯模块"],
  custom: ["生成体", "未知物体", "实验载荷"],
}

const COLORS = ["#22d3ee", "#f59e0b", "#a78bfa", "#34d399", "#f472b6", "#fb923c"]

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function generateTask(opts: {
  difficulty?: number
  kind?: TargetSpec["kind"]
  modelUrl?: string
  prompt?: string
  name?: string
} = {}): TaskSpec {
  const difficulty = opts.difficulty ?? Math.random() * 0.8 + 0.1
  const kind = opts.kind ?? (pick(["panel", "tool", "module"]) as TargetSpec["kind"])
  const baseName = pick(KIND_NAMES[kind])

  // initial position somewhere in cabin, goal at a docking slot
  const initial: Vec3 = [
    rand(-1.6, 1.6),
    rand(0.6, 2.0),
    rand(-1.6, 1.6),
  ]
  const goal: Vec3 = [
    rand(-2.2, 2.2),
    rand(0.4, 1.8),
    rand(-2.2, 2.2),
  ]

  // Ensure non-trivial separation
  const dx = goal[0] - initial[0]
  const dy = goal[1] - initial[1]
  const dz = goal[2] - initial[2]
  const sep = Math.hypot(dx, dy, dz)
  if (sep < 1.0) {
    goal[0] += 1.2
  }

  const target: TargetSpec = {
    id: "tgt_" + shortId(),
    kind,
    name: opts.name ?? baseName,
    initial,
    goal,
    radius: 0.18 + (1 - difficulty) * 0.1,
    color: pick(COLORS),
    modelUrl: opts.modelUrl,
    prompt: opts.prompt,
  }

  const task: TaskSpec = {
    id: "task_" + shortId(),
    name: `${baseName} 对接`,
    description: `将 ${baseName} 从初始位置抓取并稳定对接到目标位置。难度 ${difficulty.toFixed(2)}。`,
    difficulty,
    target,
    maxSteps: Math.round(180 + difficulty * 220),
    toleranceM: 0.12 + (1 - difficulty) * 0.08,
    drift: difficulty * 0.9,
    rewardWeights: {
      progress: 1.5,
      docking: 0.8,
      energy: 0.02 + difficulty * 0.04,
      time: 0.005,
    },
    createdAt: Date.now(),
  }
  return task
}

// Adaptive curriculum: pick next difficulty based on recent success rate
export function nextDifficulty(currentDifficulty: number, recentSuccessRate: number): number {
  // If success > 0.7, increase difficulty; if < 0.3, decrease
  const delta = recentSuccessRate > 0.7 ? 0.08 : recentSuccessRate < 0.3 ? -0.06 : 0.02
  return Math.max(0.05, Math.min(0.95, currentDifficulty + delta))
}

export const SEED_TASKS: TaskSpec[] = [
  generateTask({ difficulty: 0.2, kind: "panel", name: "散热面板 A" }),
  generateTask({ difficulty: 0.4, kind: "tool", name: "维修工具" }),
  generateTask({ difficulty: 0.6, kind: "module", name: "电池模块 B" }),
]
