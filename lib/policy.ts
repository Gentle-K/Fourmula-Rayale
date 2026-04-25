import type { Action, Policy, TaskSpec } from "./types"
import { initSim, stepSim, buildFeatures } from "./simulator"
import { shortId } from "./utils"

const ACTION_DIM = 6
const FEATURE_DIM = 10

export function emptyPolicy(name = "policy-" + shortId()): Policy {
  // Hand-crafted reasonable initial weights so untrained policy isn't useless
  const W = Array.from({ length: ACTION_DIM }, () => new Array(FEATURE_DIM).fill(0))
  // base reacts to dx/dz
  W[0][0] = 0.3
  W[0][2] = 0.3
  // shoulder reacts to dy
  W[1][1] = 0.5
  // elbow reacts to dist
  W[2][3] = -0.3
  // wrist small
  W[3][1] = -0.2
  // grip turns on when close (negative bias on dist via b)
  // thrust pushes when holding
  W[5][4] = 0.6 // holding
  const b = [0, 0, 0, 0, -0.6, 0]
  // Encourage closing grip when close: negative bias offset by dist feature
  W[4][3] = -1.5
  return {
    id: shortId(),
    name,
    W,
    b,
    iterations: 0,
    bestReturn: -Infinity,
    avgReturn: 0,
    taskFamily: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function policyAct(p: Policy, features: number[]): Action {
  const out = new Array(ACTION_DIM).fill(0)
  for (let i = 0; i < ACTION_DIM; i++) {
    let s = p.b[i]
    for (let j = 0; j < FEATURE_DIM; j++) s += p.W[i][j] * features[j]
    out[i] = Math.tanh(s)
  }
  return {
    base: out[0],
    shoulder: out[1],
    elbow: out[2],
    wrist: out[3],
    grip: (out[4] + 1) / 2, // map to 0..1
    thrust: out[5],
  }
}

export function rolloutTask(
  policy: Policy,
  task: TaskSpec,
  seed = 1,
  noise = 0,
  imitationSamples: Action[] = [],
  imitationWeight = 0,
): { totalReward: number; success: boolean; steps: number } {
  let s = initSim(task, seed)
  let success = false
  let imitationPenalty = 0
  while (!s.done) {
    const f = buildFeatures(s)
    const a = policyAct(policy, f)
    if (noise > 0) {
      a.base += (Math.random() - 0.5) * 2 * noise
      a.shoulder += (Math.random() - 0.5) * 2 * noise
      a.elbow += (Math.random() - 0.5) * 2 * noise
      a.wrist += (Math.random() - 0.5) * 2 * noise
      a.thrust += (Math.random() - 0.5) * 2 * noise
    }
    if (imitationSamples.length > 0 && imitationWeight > 0) {
      const guide = imitationSamples[s.step % imitationSamples.length]
      imitationPenalty += actionDistance(a, guide) * imitationWeight
    }
    const r = stepSim(s, a)
    s = r.state
    if (s.success) success = true
  }
  return { totalReward: s.totalReward - imitationPenalty, success, steps: s.step }
}

// Cross-Entropy Method (CEM) for the linear policy.
// We sample W,b deltas from a Gaussian, evaluate on the task batch,
// keep the elite top-k, refit mean.
export function* trainCEM(
  base: Policy,
  tasks: TaskSpec[],
  opts: {
    iterations?: number
    populationSize?: number
    eliteFrac?: number
    sigma?: number
    seed?: number
    imitationSamples?: Action[]
    imitationWeight?: number
  } = {},
) {
  const iterations = opts.iterations ?? 12
  const N = opts.populationSize ?? 16
  const eliteFrac = opts.eliteFrac ?? 0.25
  let sigma = opts.sigma ?? 0.4
  const eliteCount = Math.max(2, Math.floor(N * eliteFrac))

  // Flat parameter vector: W (6*10) + b (6) = 66
  const flatLen = ACTION_DIM * FEATURE_DIM + ACTION_DIM
  const meanFlat = flattenPolicy(base)
  let mean = [...meanFlat]
  let bestPolicy = clonePolicy(base)
  let bestReturn = -Infinity

  for (let iter = 0; iter < iterations; iter++) {
    // Sample population
    const pop: { params: number[]; fitness: number; success: number }[] = []
    for (let i = 0; i < N; i++) {
      const params = mean.map((m) => m + gaussian() * sigma)
      const policy = unflattenPolicy(params, base)
      let totalFit = 0
      let succ = 0
      for (let k = 0; k < tasks.length; k++) {
        const r = rolloutTask(
          policy,
          tasks[k],
          (opts.seed ?? 1) + iter * 1000 + k,
          0,
          opts.imitationSamples,
          opts.imitationWeight ?? 0,
        )
        totalFit += r.totalReward
        if (r.success) succ++
      }
      const avgFit = totalFit / tasks.length
      pop.push({ params, fitness: avgFit, success: succ / tasks.length })
      if (avgFit > bestReturn) {
        bestReturn = avgFit
        bestPolicy = unflattenPolicy(params, base)
        bestPolicy.bestReturn = bestReturn
      }
    }
    pop.sort((a, b) => b.fitness - a.fitness)
    const elite = pop.slice(0, eliteCount)
    // Refit mean
    for (let d = 0; d < flatLen; d++) {
      let sum = 0
      for (const e of elite) sum += e.params[d]
      mean[d] = sum / elite.length
    }
    // Decay sigma
    sigma *= 0.92

    const updated = unflattenPolicy(mean, base)
    updated.iterations = base.iterations + iter + 1
    updated.bestReturn = Math.max(bestPolicy.bestReturn, bestReturn)
    updated.avgReturn = elite.reduce((a, b) => a + b.fitness, 0) / elite.length
    updated.updatedAt = Date.now()

    yield {
      iter: iter + 1,
      total: iterations,
      eliteAvg: updated.avgReturn,
      best: bestPolicy.bestReturn,
      successRate: elite.reduce((a, b) => a + b.success, 0) / elite.length,
      meanPolicy: updated,
      bestPolicy,
    }
  }
}

function actionDistance(a: Action, b: Action): number {
  return (
    Math.abs(a.base - b.base) +
    Math.abs(a.shoulder - b.shoulder) +
    Math.abs(a.elbow - b.elbow) +
    Math.abs(a.wrist - b.wrist) +
    Math.abs(a.grip - b.grip) +
    Math.abs(a.thrust - b.thrust)
  )
}

function gaussian() {
  // Box-Muller
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function flattenPolicy(p: Policy): number[] {
  const out: number[] = []
  for (let i = 0; i < ACTION_DIM; i++) for (let j = 0; j < FEATURE_DIM; j++) out.push(p.W[i][j])
  for (let i = 0; i < ACTION_DIM; i++) out.push(p.b[i])
  return out
}

function unflattenPolicy(flat: number[], base: Policy): Policy {
  const W: number[][] = []
  let k = 0
  for (let i = 0; i < ACTION_DIM; i++) {
    const row: number[] = []
    for (let j = 0; j < FEATURE_DIM; j++) row.push(flat[k++])
    W.push(row)
  }
  const b: number[] = []
  for (let i = 0; i < ACTION_DIM; i++) b.push(flat[k++])
  return {
    ...base,
    W,
    b,
    updatedAt: Date.now(),
  }
}

export function clonePolicy(p: Policy): Policy {
  return {
    ...p,
    W: p.W.map((r) => [...r]),
    b: [...p.b],
  }
}

export function evaluateOnTaskFamily(
  policy: Policy,
  tasks: TaskSpec[],
  trialsPerTask = 2,
): { perTask: { taskId: string; avgReturn: number; successRate: number }[]; generalization: number } {
  const perTask: { taskId: string; avgReturn: number; successRate: number }[] = []
  let avgSucc = 0
  for (const t of tasks) {
    let totalR = 0
    let succ = 0
    for (let i = 0; i < trialsPerTask; i++) {
      const r = rolloutTask(policy, t, i + 1)
      totalR += r.totalReward
      if (r.success) succ++
    }
    const sr = succ / trialsPerTask
    perTask.push({ taskId: t.id, avgReturn: totalR / trialsPerTask, successRate: sr })
    avgSucc += sr
  }
  return { perTask, generalization: avgSucc / Math.max(1, tasks.length) }
}
