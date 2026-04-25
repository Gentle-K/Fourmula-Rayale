"use client"
import { Suspense, useMemo } from "react"
import { useGLTF, Html } from "@react-three/drei"
import * as THREE from "three"
import type { TargetSpec, Vec3 } from "@/lib/types"

type Props = {
  target: TargetSpec
  position: Vec3
  held?: boolean
}

function FallbackMesh({ kind, color }: { kind: TargetSpec["kind"]; color: string }) {
  if (kind === "panel") {
    return (
      <mesh castShadow>
        <boxGeometry args={[0.5, 0.32, 0.04]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} metalness={0.4} roughness={0.4} />
      </mesh>
    )
  }
  if (kind === "tool") {
    return (
      <group>
        <mesh castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.4, 12]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.22, 0]} castShadow>
          <boxGeometry args={[0.18, 0.06, 0.06]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
        </mesh>
      </group>
    )
  }
  if (kind === "module") {
    return (
      <mesh castShadow>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} metalness={0.5} roughness={0.4} />
      </mesh>
    )
  }
  return (
    <mesh castShadow>
      <icosahedronGeometry args={[0.22, 0]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} metalness={0.5} roughness={0.4} />
    </mesh>
  )
}

function GLBModel({ url, fallbackColor, kind }: { url: string; fallbackColor: string; kind: TargetSpec["kind"] }) {
  try {
    const gltf = useGLTF(url) as any
    const scene = useMemo(() => {
      const cloned = gltf.scene.clone(true) as THREE.Object3D
      // normalize scale: fit into ~0.5m bounding sphere
      const box = new THREE.Box3().setFromObject(cloned)
      const size = new THREE.Vector3()
      box.getSize(size)
      const max = Math.max(size.x, size.y, size.z) || 1
      const target = 0.5
      cloned.scale.setScalar(target / max)
      box.setFromObject(cloned)
      const center = new THREE.Vector3()
      box.getCenter(center)
      cloned.position.sub(center.multiplyScalar(target / max))
      cloned.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh) {
          m.castShadow = true
          m.receiveShadow = true
        }
      })
      return cloned
    }, [gltf])
    return <primitive object={scene} />
  } catch {
    return <FallbackMesh kind={kind} color={fallbackColor} />
  }
}

export function TargetObject({ target, position, held }: Props) {
  return (
    <group position={position}>
      <pointLight intensity={held ? 1.2 : 0.4} distance={1.4} color={target.color} />
      <Suspense fallback={<FallbackMesh kind={target.kind} color={target.color} />}>
        {target.modelUrl ? (
          <GLBModel url={target.modelUrl} fallbackColor={target.color} kind={target.kind} />
        ) : (
          <FallbackMesh kind={target.kind} color={target.color} />
        )}
      </Suspense>
      {held && (
        <Html center distanceFactor={6}>
          <div className="rounded bg-accent/90 px-1.5 py-0.5 text-[9px] font-mono uppercase text-accent-foreground">
            HELD
          </div>
        </Html>
      )}
    </group>
  )
}

export function GoalMarker({ position, color, tolerance }: { position: Vec3; color: string; tolerance: number }) {
  return (
    <group position={position}>
      {/* docking ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[tolerance + 0.05, 0.012, 8, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
      </mesh>
      <mesh rotation={[0, 0, 0]}>
        <torusGeometry args={[tolerance + 0.05, 0.012, 8, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  )
}
