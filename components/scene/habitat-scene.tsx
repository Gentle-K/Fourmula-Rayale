"use client"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"
import { useEffect, useRef } from "react"
import * as THREE from "three"
import { IssEnvironment } from "./iss-environment"
import { RobotArm } from "./robot-arm"
import { GoalMarker, TargetObject } from "./target-object"
import { useHabitat } from "@/lib/store"
import { defaultAgent } from "@/lib/simulator"

function SimDriver({ rate = 20 }: { rate?: number }) {
  const acc = useRef(0)
  const tick = useRef<(() => void) | null>(null)
  const tickRef = useRef(0)

  useFrame((_, dt) => {
    acc.current += dt
    const stepDur = 1 / rate
    while (acc.current >= stepDur) {
      acc.current -= stepDur
      const s = useHabitat.getState()
      if (s.runState !== "running") return
      if (s.mode === "manual") s.tickManual()
      else if (s.mode === "auto" || s.mode === "learn" || s.mode === "curriculum") s.tickAuto()
      else if (s.mode === "replay") {
        const more = s.tickReplay()
        if (!more) return
      }
      tickRef.current++
      tick.current?.()
    }
  })
  return null
}

function TargetTrail({ points }: { points: THREE.Vector3[] }) {
  const ref = useRef<THREE.Line>(null)
  useEffect(() => {
    if (!ref.current) return
    const geom = new THREE.BufferGeometry().setFromPoints(points)
    ref.current.geometry.dispose()
    ref.current.geometry = geom
  }, [points])
  return (
    // @ts-expect-error r3f line type
    <line ref={ref}>
      <bufferGeometry />
      <lineBasicMaterial color="#22d3ee" transparent opacity={0.6} />
    </line>
  )
}

function SceneContent() {
  const sim = useHabitat((s) => s.sim)
  const tasks = useHabitat((s) => s.tasks)
  const activeTaskId = useHabitat((s) => s.activeTaskId)
  const steps = useHabitat((s) => s.steps)
  const activeTask = tasks.find((t) => t.id === activeTaskId)

  const agent = sim?.agent ?? defaultAgent()
  const targetPos = sim?.targetPos ?? activeTask?.target.initial ?? [0, 1, 1]
  const target = activeTask?.target ?? null
  const held = agent.holding === target?.id

  // Trail of target positions, last 60
  const trail = (() => {
    const pts: THREE.Vector3[] = []
    const slice = steps.slice(-60)
    for (const s of slice) pts.push(new THREE.Vector3(...s.targetPos))
    return pts
  })()

  return (
    <>
      <PerspectiveCamera makeDefault position={[5.5, 3.2, 5.5]} fov={45} />
      <OrbitControls
        target={[0, 0.3, 0]}
        enableDamping
        dampingFactor={0.08}
        minDistance={3}
        maxDistance={12}
        maxPolarAngle={Math.PI * 0.85}
      />
      <IssEnvironment />
      <RobotArm agent={agent} highlightGrip={held} />
      {target && (
        <>
          <TargetObject target={target} position={targetPos} held={held} />
          <GoalMarker position={target.goal} color={target.color} tolerance={activeTask?.toleranceM ?? 0.15} />
        </>
      )}
      {trail.length > 1 && <TargetTrail points={trail} />}
      <SimDriver />
    </>
  )
}

export function HabitatScene() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-border bg-[#070b16]">
      <div className="absolute inset-0 bg-stars opacity-30" />
      <Canvas shadows dpr={[1, 1.6]} className="!h-full !w-full">
        <SceneContent />
      </Canvas>
      <SceneHud />
    </div>
  )
}

function SceneHud() {
  const sim = useHabitat((s) => s.sim)
  const mode = useHabitat((s) => s.mode)
  const runState = useHabitat((s) => s.runState)
  const activeTask = useHabitat((s) => s.tasks.find((t) => t.id === s.activeTaskId))

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
      <div className="flex items-start justify-between">
        <div className="rounded-md border border-border/60 bg-card/70 px-2.5 py-1.5 backdrop-blur">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Habitat</div>
          <div className="font-mono text-xs text-primary">ISS · Node-7 · Bay 04</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="rounded-md border border-border/60 bg-card/70 px-2.5 py-1.5 backdrop-blur">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  runState === "running" ? "bg-emerald-400" : runState === "completed" ? "bg-primary" : "bg-muted-foreground"
                }`}
              />
              {runState}
            </div>
            <div className="font-mono text-xs">
              {mode.toUpperCase()} · t={sim?.step ?? 0}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div className="rounded-md border border-border/60 bg-card/70 px-2.5 py-1.5 backdrop-blur">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Task</div>
          <div className="font-mono text-xs">
            {activeTask?.name ?? "—"} · diff {(activeTask?.difficulty ?? 0).toFixed(2)}
          </div>
        </div>
        <div className="rounded-md border border-border/60 bg-card/70 px-2.5 py-1.5 backdrop-blur tabular">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Reward</div>
          <div className="font-mono text-xs text-accent">{(sim?.totalReward ?? 0).toFixed(2)}</div>
        </div>
      </div>
    </div>
  )
}
