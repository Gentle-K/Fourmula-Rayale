export type Vec3 = [number, number, number]

export type Action = {
  // 6-DOF arm command, normalized [-1, 1]
  base: number // base rotation
  shoulder: number
  elbow: number
  wrist: number
  grip: number // 0 = open, 1 = close
  thrust: number // micro-impulse along approach axis
}

export type AgentState = {
  joints: { base: number; shoulder: number; elbow: number; wrist: number }
  endEffector: Vec3
  holding: string | null // target id
  velocity: Vec3
  energyUsed: number
}

export type TargetSpec = {
  id: string
  kind: "panel" | "tool" | "module" | "custom"
  name: string
  initial: Vec3
  goal: Vec3
  radius: number
  color: string
  modelUrl?: string // optional Tripo3D GLB
  prompt?: string // generation prompt for provenance
}

export type TaskSpec = {
  id: string
  name: string
  description: string
  difficulty: number // 0..1
  target: TargetSpec
  maxSteps: number
  toleranceM: number // meters
  drift: number // background micro-gravity drift, 0..1
  rewardWeights: {
    progress: number
    docking: number
    energy: number
    time: number
  }
  createdAt: number
}

export type StepRecord = {
  t: number
  action: Action
  agent: AgentState
  targetPos: Vec3
  reward: number
  done: boolean
}

export type Episode = {
  id: string
  taskId: string
  taskName: string
  mode: ControlMode
  steps: StepRecord[]
  totalReward: number
  success: boolean
  durationSteps: number
  energyUsed: number
  createdAt: number
  policyId?: string
}

export type ControlMode = "manual" | "replay" | "learn" | "auto" | "curriculum"

// Linear policy: action = W * features + b
// features = [dx, dy, dz, dist, holding, vx, vy, vz, drift, 1]
export type Policy = {
  id: string
  name: string
  // 6 actions x 10 features
  W: number[][]
  b: number[]
  // training stats
  iterations: number
  bestReturn: number
  avgReturn: number
  taskFamily: string[] // task ids it was trained on
  createdAt: number
  updatedAt: number
}

export type AssetItem = {
  id: string
  prompt: string
  status: "queued" | "running" | "succeeded" | "failed"
  progress: number // 0..1
  modelUrl?: string
  thumbnailUrl?: string
  taskId?: string // tripo task id
  createdAt: number
  error?: string
  kind: TargetSpec["kind"]
}

export type GenerationEvent =
  | { type: "queued"; assetId: string }
  | { type: "progress"; assetId: string; progress: number; status: string }
  | { type: "completed"; assetId: string; modelUrl: string; thumbnailUrl?: string }
  | { type: "failed"; assetId: string; error: string }
