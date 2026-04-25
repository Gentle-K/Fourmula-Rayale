"use client"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { IssEnvironment } from "./iss-environment"
import { OrbitScene } from "./orbit-scene"
import { ProceduralRobot } from "./procedural-robot"
import { GoalMarker, TargetObject } from "./target-object"
import { ModelSlot } from "./model-slot"
import { WorldDashboard } from "./world-dashboard"
import { useHabitat } from "@/lib/store"
import { defaultAgent } from "@/lib/simulator"

const XRRuntime = lazy(() => import("./xr-runtime").then((module) => ({ default: module.XRRuntime })))
const HABITAT_SLOT = "/models/habitat.glb"

function SimDriver({ rate = 20 }: { rate?: number }) {
  useEffect(() => {
    const interval = window.setInterval(() => {
      const s = useHabitat.getState()
      if (s.runState !== "running") return
      if (s.mode === "manual") s.tickManual()
      else if (s.mode === "auto" || s.mode === "learn" || s.mode === "curriculum") s.tickAuto()
      else if (s.mode === "replay") {
        const more = s.tickReplay()
        if (!more) return
      }
    }, 1000 / rate)
    return () => window.clearInterval(interval)
  }, [rate])

  return null
}

function CameraRig() {
  const phase = useHabitat((s) => s.scenePhase)
  const { camera, gl } = useThree()
  const target = useMemo(() => new THREE.Vector3(), [])
  const desired = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, dt) => {
    if (gl.xr.isPresenting) return
    if (phase === "orbit") {
      desired.set(0, 1.65, 7.2)
      target.set(0, 0.12, 0)
    } else if (phase === "transitioning") {
      desired.set(0, 0.95, 3.0)
      target.set(0, 0.1, 0)
    } else {
      desired.set(5.5, 3.2, 5.5)
      target.set(0, 0.3, 0)
    }
    const alpha = Math.min(1, dt * (phase === "transitioning" ? 2.8 : 1.6))
    camera.position.lerp(desired, alpha)
    camera.lookAt(target)
  })

  return <PerspectiveCamera makeDefault position={[0, 1.65, 7.2]} fov={45} />
}

function RendererBackdrop() {
  const { gl, scene } = useThree()
  const background = useMemo(() => new THREE.Color("#030712"), [])

  useEffect(() => {
    scene.background = background
    gl.setClearColor(background, 1)
    gl.setClearAlpha(1)
    gl.domElement.style.backgroundColor = "#030712"
  }, [background, gl, scene])

  useFrame(() => {
    if (scene.background !== background) scene.background = background
    gl.setClearColor(background, 1)
  }, -1000)

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

function HabitatInteriorScene() {
  const sim = useHabitat((s) => s.sim)
  const tasks = useHabitat((s) => s.tasks)
  const activeTaskId = useHabitat((s) => s.activeTaskId)
  const steps = useHabitat((s) => s.steps)
  const assets = useHabitat((s) => s.assets)
  const robotAssetId = useHabitat((s) => s.robotAssetId)
  const activeTask = tasks.find((t) => t.id === activeTaskId)

  const agent = sim?.agent ?? defaultAgent()
  const robotAsset = assets.find((asset) => asset.id === robotAssetId)
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
      <ambientLight intensity={0.28} color="#a5b4fc" />
      <ModelSlot url={HABITAT_SLOT} normalizeSize={7.2} fallback={<IssEnvironment />} />
      <ProceduralRobot agent={agent} highlightGrip={held} skinUrl={robotAsset?.modelUrl} />
      {target && (
        <>
          <TargetObject target={target} position={targetPos} held={held} />
          <GoalMarker position={target.goal} color={target.color} tolerance={activeTask?.toleranceM ?? 0.15} />
        </>
      )}
      {trail.length > 1 && <TargetTrail points={trail} />}
      <WorldDashboard />
      <SimDriver />
    </>
  )
}

function SceneContent() {
  const phase = useHabitat((s) => s.scenePhase)

  return (
    <>
      <RendererBackdrop />
      <CameraRig />
      <OrbitControls
        target={phase === "habitat" ? [0, 0.3, 0] : [0, 0.1, 0]}
        enableDamping
        dampingFactor={0.08}
        minDistance={phase === "habitat" ? 3 : 4}
        maxDistance={phase === "habitat" ? 12 : 10}
        maxPolarAngle={Math.PI * 0.85}
      />
      {phase === "habitat" ? <HabitatInteriorScene /> : <OrbitScene />}
    </>
  )
}

export function HabitatScene() {
  const [xrError, setXrError] = useState<string | null>(null)
  const [xrEnabled, setXrEnabled] = useState(false)
  const [xrSessionRequest, setXrSessionRequest] = useState(0)

  const enterVR = () => {
    setXrError(null)
    setXrEnabled(true)
    setXrSessionRequest((request) => request + 1)
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-border bg-[#070b16]" style={{ background: "#070b16" }}>
      <div className="absolute inset-0 bg-stars opacity-30" />
      <Canvas
        shadows
        dpr={[1, 1.6]}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => gl.setClearColor("#030712", 0)}
        style={{ background: "transparent" }}
        className="!h-full !w-full"
      >
        {xrEnabled ? (
          <Suspense fallback={<SceneContent />}>
            <XRRuntime requestId={xrSessionRequest} onError={setXrError}>
              <SceneContent />
            </XRRuntime>
          </Suspense>
        ) : (
          <SceneContent />
        )}
      </Canvas>
      <SceneHud onEnterVR={enterVR} xrError={xrError} />
    </div>
  )
}

function SceneHud({ onEnterVR, xrError }: { onEnterVR: () => void; xrError: string | null }) {
  const sim = useHabitat((s) => s.sim)
  const mode = useHabitat((s) => s.mode)
  const runState = useHabitat((s) => s.runState)
  const scenePhase = useHabitat((s) => s.scenePhase)
  const deadlock = useHabitat((s) => s.deadlock)
  const intervention = useHabitat((s) => s.intervention)
  const activeTask = useHabitat((s) => s.tasks.find((t) => t.id === s.activeTaskId))
  const enterHabitat = useHabitat((s) => s.enterHabitat)

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
      <div className="flex items-start justify-between">
        <div className="rounded-md border border-border/60 bg-card/70 px-2.5 py-1.5 backdrop-blur">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {scenePhase === "orbit" ? "Orbit" : "Habitat"}
          </div>
          <div className="font-mono text-xs text-primary">
            {scenePhase === "orbit" ? "ISS · Trigger entry target" : "ISS · Node-7 · Bay 04"}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="pointer-events-auto flex items-center gap-2">
            {scenePhase !== "habitat" && (
              <button
                onClick={enterHabitat}
                className="rounded-md border border-primary/40 bg-primary/15 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary backdrop-blur hover:bg-primary/25"
              >
                Enter Habitat
              </button>
            )}
            <button
              onClick={onEnterVR}
              className="rounded-md border border-accent/50 bg-accent/15 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-accent backdrop-blur hover:bg-accent/25"
            >
              Enter VR
            </button>
          </div>
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
          {xrError && (
            <div className="max-w-[260px] rounded-md border border-destructive/50 bg-destructive/15 px-2.5 py-1.5 text-right text-[10px] text-destructive backdrop-blur">
              {xrError}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div className="rounded-md border border-border/60 bg-card/70 px-2.5 py-1.5 backdrop-blur">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {intervention.active ? "Intervention" : deadlock.active ? "Assist Needed" : "Task"}
          </div>
          <div className="font-mono text-xs">
            {intervention.active
              ? `${intervention.reason ?? "assist"} · manual override`
              : deadlock.active
                ? `reward stalled ${deadlock.staleSteps} steps`
                : `${activeTask?.name ?? "—"} · diff ${(activeTask?.difficulty ?? 0).toFixed(2)}`}
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
