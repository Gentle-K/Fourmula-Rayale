"use client"

import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from "react"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"

type ModelSlotProps = {
  url?: string | null
  normalizeSize?: number
  fallback: ReactNode
}

type BoundaryProps = {
  fallback: ReactNode
  children: ReactNode
}

class ModelErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) return this.props.fallback
    return this.props.children
  }
}

function useModelAvailability(url?: string | null) {
  const [available, setAvailable] = useState(() => Boolean(url && /^https?:\/\//.test(url)))

  useEffect(() => {
    let alive = true
    if (!url) {
      setAvailable(false)
      return
    }
    if (/^https?:\/\//.test(url)) {
      setAvailable(true)
      return
    }
    fetch(url, { method: "HEAD" })
      .then((res) => {
        if (alive) setAvailable(res.ok)
      })
      .catch(() => {
        if (alive) setAvailable(false)
      })
    return () => {
      alive = false
    }
  }, [url])

  return available
}

function NormalizedGLB({ url, normalizeSize = 1 }: { url: string; normalizeSize?: number }) {
  const gltf = useGLTF(url) as any
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true) as THREE.Object3D
    const box = new THREE.Box3().setFromObject(cloned)
    const size = new THREE.Vector3()
    box.getSize(size)
    const max = Math.max(size.x, size.y, size.z) || 1
    cloned.scale.setScalar(normalizeSize / max)
    box.setFromObject(cloned)
    const center = new THREE.Vector3()
    box.getCenter(center)
    cloned.position.sub(center)
    cloned.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
    return cloned
  }, [gltf, normalizeSize])

  return <primitive object={scene} />
}

export function ModelSlot({ url, normalizeSize, fallback }: ModelSlotProps) {
  const available = useModelAvailability(url)
  if (!url || !available) return <>{fallback}</>

  return (
    <ModelErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <NormalizedGLB url={url} normalizeSize={normalizeSize} />
      </Suspense>
    </ModelErrorBoundary>
  )
}
