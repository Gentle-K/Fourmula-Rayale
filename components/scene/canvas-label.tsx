"use client"

import { useEffect, useMemo } from "react"
import * as THREE from "three"

type CanvasLabelProps = {
  text: string
  position?: [number, number, number]
  fontSize?: number
  color?: string
  anchorX?: "left" | "center" | "right"
  anchorY?: "middle"
  weight?: number
}

function nextPowerOfTwo(value: number) {
  return 2 ** Math.ceil(Math.log2(Math.max(2, value)))
}

export function CanvasLabel({
  text,
  position = [0, 0, 0],
  fontSize = 0.06,
  color = "#e2e8f0",
  anchorX = "center",
  weight = 600,
}: CanvasLabelProps) {
  const { texture, width, height } = useMemo(() => {
    const fontPx = 64
    const paddingX = 20
    const paddingY = 12
    const canvas = document.createElement("canvas")
    const measureContext = canvas.getContext("2d")
    const font = `${weight} ${fontPx}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`

    if (!measureContext) {
      const fallbackTexture = new THREE.CanvasTexture(canvas)
      return { texture: fallbackTexture, width: 1, height: 0.25 }
    }

    measureContext.font = font
    const measured = Math.ceil(measureContext.measureText(text).width)
    const rawWidth = measured + paddingX * 2
    const rawHeight = fontPx + paddingY * 2
    canvas.width = nextPowerOfTwo(rawWidth)
    canvas.height = nextPowerOfTwo(rawHeight)

    const context = canvas.getContext("2d")
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.font = font
      context.fillStyle = color
      context.textBaseline = "middle"
      context.textAlign = anchorX
      const x = anchorX === "left" ? paddingX : anchorX === "right" ? canvas.width - paddingX : canvas.width / 2
      context.fillText(text, x, canvas.height / 2)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.needsUpdate = true
    const height = fontSize * 1.55
    const width = height * (canvas.width / canvas.height)
    return { texture, width, height }
  }, [anchorX, color, fontSize, text, weight])

  useEffect(() => {
    return () => texture.dispose()
  }, [texture])

  const xOffset = anchorX === "left" ? width / 2 : anchorX === "right" ? -width / 2 : 0

  return (
    <group position={position}>
      <sprite position={[xOffset, 0, 0]} scale={[width, height, 1]}>
        <spriteMaterial map={texture} transparent depthWrite={false} />
      </sprite>
    </group>
  )
}
