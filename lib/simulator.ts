import type { Action, AgentState, StepRecord, TaskSpec, Vec3 } from "./types"
import { clamp } from "./utils"

// Simple kinematic arm simulator with microgravity drift.
// Coordinates: ISS interior frame, meters. Arm base at origin.
// End-effector position is computed from joint angles via a 3-link arm model.

export const ARM = {
  L1: 1.4, // shoulder->elbow
  L2: 1.2, // elbow->wrist
  L3: 0.6, // wrist->ee
  baseHeight: 0.6,
}

export const STEP_DT = 0.05 // seconds per sim step (20 Hz)
export const JOINT_SPEED = 1.6 // rad/s
export const THRUST_GAIN = 0.4 // m/s per unit thrust

export function defaultAgent(): AgentState {
  return {
    joints: { base: 0, shoulder: -0.3, elbow: 0.7, wrist: -0.2 },
    endEffector: forwardKin({ base: 0, shoulder: -0.3, elbow: 0.7, wrist: -0.2 }),
    holding: null,
    velocity: [0, 0, 0],
    energyUsed: 0,
  }
}

export function forwardKin(j: AgentState["joints"]): Vec3 {
  // Planar 3-link arm in shoulder plane, then rotate by base around Y.
  const { L1, L2, L3, baseHeight } = ARM
  const a1 = j.shoulder
  const a2 = a1 + j.elbow
  const a3 = a2 + j.wrist
  const px = L1 * Math.cos(a1) + L2 * Math.cos(a2) + L3 * Math.cos(a3)
  const py = baseHeight + L1 * Math.sin(a1) + L2 * Math.sin(a2) + L3 * Math.sin(a3)
  // rotate around Y by base
  const cb = Math.cos(j.base)
  const sb = Math.sin(j.base)
  return [px * cb, py, px * sb]
}

function dist3(a: Vec3, b: Vec3) {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const dz = a[2] - b[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s]
}

export type SimState = {
  task: TaskSpec
  agent: AgentState
  targetPos: Vec3
  step: number
  totalReward: number
  done: boolean
  success: boolean
  // small RNG state for reproducibility
  seed: number
}

export function initSim(task: TaskSpec, seed = 1): SimState {
  return {
    task,
    agent: defaultAgent(),
    targetPos: [...task.target.initial] as Vec3,
    step: 0,
    totalReward: 0,
    done: false,
    success: false,
    seed,
  }
}

function rng(state: { seed: number }) {
  // mulberry32
  state.seed |= 0
  state.seed = (state.seed + 0x6d2b79f5) | 0
  let t = state.seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function stepSim(s: SimState, action: Action): { state: SimState; record: StepRecord } {
  if (s.done) {
    const record: StepRecord = {
      t: s.step,
      action,
      agent: s.agent,
      targetPos: s.targetPos,
      reward: 0,
      done: true,
    }
    return { state: s, record }
  }

  const a: Action = {
    base: clamp(action.base, -1, 1),
    shoulder: clamp(action.shoulder, -1, 1),
    elbow: clamp(action.elbow, -1, 1),
    wrist: clamp(action.wrist, -1, 1),
    grip: clamp(action.grip, 0, 1),
    thrust: clamp(action.thrust, -1, 1),
  }

  // Distance before
  const eeBefore = forwardKin(s.agent.joints)
  const distBefore = dist3(eeBefore, s.targetPos)

  // Update joints
  const j = { ...s.agent.joints }
  j.base = clamp(j.base + a.base * JOINT_SPEED * STEP_DT, -Math.PI, Math.PI)
  j.shoulder = clamp(j.shoulder + a.shoulder * JOINT_SPEED * STEP_DT, -1.4, 1.4)
  j.elbow = clamp(j.elbow + a.elbow * JOINT_SPEED * STEP_DT, -0.1, 2.4)
  j.wrist = clamp(j.wrist + a.wrist * JOINT_SPEED * STEP_DT, -1.5, 1.5)

  const ee = forwardKin(j)

  // Target dynamics: holding follows EE; else drifts with microgravity
  let targetPos: Vec3
  let velocity: Vec3 = s.agent.velocity
  let holding = s.agent.holding

  if (holding === s.task.target.id) {
    // Carried: follows EE; thrust nudges target velocity in approach direction
    const toGoal = sub(s.task.target.goal, ee)
    const norm = Math.hypot(toGoal[0], toGoal[1], toGoal[2]) || 1
    const dir = scale(toGoal, 1 / norm)
    velocity = scale(dir, a.thrust * THRUST_GAIN)
    targetPos = ee
  } else {
    // Free-floating with mild drift
    const driftMag = s.task.drift * 0.06
    const drift: Vec3 = [
      (rng(s) - 0.5) * driftMag,
      (rng(s) - 0.5) * driftMag * 0.5,
      (rng(s) - 0.5) * driftMag,
    ]
    velocity = add(s.agent.velocity, drift)
    velocity = scale(velocity, 0.92) // damping (air drag inside cabin)
    targetPos = add(s.targetPos, scale(velocity, STEP_DT))

    // Check grip: if close enough and grip closed, attach
    const dEE = dist3(ee, targetPos)
    if (a.grip > 0.5 && dEE < s.task.target.radius + 0.18) {
      holding = s.task.target.id
      velocity = [0, 0, 0]
      targetPos = ee
    }
  }

  // If holding and grip released far from goal, drop
  if (holding === s.task.target.id && a.grip < 0.3) {
    const dGoal = dist3(targetPos, s.task.target.goal)
    if (dGoal > s.task.toleranceM) {
      holding = null
    }
  }

  // Reward shaping
  const distAfter = dist3(ee, targetPos)
  const dGoalNow = dist3(targetPos, s.task.target.goal)
  const w = s.task.rewardWeights

  const progress = (distBefore - distAfter) * w.progress
  const dockingBonus = holding === s.task.target.id ? (1 / (1 + dGoalNow)) * w.docking : 0
  const energyCost =
    (Math.abs(a.base) + Math.abs(a.shoulder) + Math.abs(a.elbow) + Math.abs(a.wrist) + Math.abs(a.thrust)) *
    w.energy
  const timePenalty = w.time

  let reward = progress + dockingBonus - energyCost - timePenalty

  // Success: target at goal within tolerance and not held (placed)
  let done = false
  let success = false
  if (dGoalNow < s.task.toleranceM && holding !== s.task.target.id) {
    reward += 5
    done = true
    success = true
  }

  // Bound check / timeout
  if (s.step + 1 >= s.task.maxSteps) {
    done = true
  }

  // Out of bounds
  if (Math.abs(targetPos[0]) > 6 || Math.abs(targetPos[1]) > 4 || Math.abs(targetPos[2]) > 6) {
    reward -= 2
    done = true
  }

  const energyUsed = s.agent.energyUsed + Math.abs(energyCost)

  const newAgent: AgentState = {
    joints: j,
    endEffector: ee,
    holding,
    velocity,
    energyUsed,
  }

  const newState: SimState = {
    ...s,
    agent: newAgent,
    targetPos,
    step: s.step + 1,
    totalReward: s.totalReward + reward,
    done,
    success,
  }

  const record: StepRecord = {
    t: s.step + 1,
    action: a,
    agent: newAgent,
    targetPos,
    reward,
    done,
  }

  return { state: newState, record }
}

export function buildFeatures(s: SimState): number[] {
  const ee = s.agent.endEffector
  const t = s.targetPos
  const d: Vec3 = [t[0] - ee[0], t[1] - ee[1], t[2] - ee[2]]
  const dist = Math.hypot(d[0], d[1], d[2])
  const v = s.agent.velocity
  const holding = s.agent.holding === s.task.target.id ? 1 : 0
  return [d[0], d[1], d[2], dist, holding, v[0], v[1], v[2], s.task.drift, 1]
}
