"use client"

import { useFrame } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import * as THREE from "three"

type StarFieldProps = {
  count?: number
  radius?: number
  depth?: number
  speed?: number
}

export function StarField({ count = 1800, radius = 70, depth = 55, speed = 0.02 }: StarFieldProps) {
  const ref = useRef<THREE.Points>(null)
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const u = Math.random() * 2 - 1
      const r = radius - Math.random() * depth
      const root = Math.sqrt(1 - u * u)
      positions[i * 3] = r * root * Math.cos(theta)
      positions[i * 3 + 1] = r * u
      positions[i * 3 + 2] = r * root * Math.sin(theta)
    }

    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    return buffer
  }, [count, depth, radius])

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * speed
  })

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial color="#e2e8f0" size={0.035} sizeAttenuation transparent opacity={0.72} depthWrite={false} />
    </points>
  )
}
