"use client"

import { XR, createXRStore } from "@react-three/xr"
import { useEffect, type ReactNode } from "react"

const xrStore = createXRStore()

type XRRuntimeProps = {
  children: ReactNode
  requestId: number
  onError: (message: string) => void
}

export function XRRuntime({ children, requestId, onError }: XRRuntimeProps) {
  useEffect(() => {
    if (requestId <= 0) return

    const id = window.setTimeout(() => {
      Promise.resolve(xrStore.enterVR()).catch((err: any) => {
        onError(err?.message ?? "WebXR session failed")
      })
    }, 0)

    return () => window.clearTimeout(id)
  }, [requestId, onError])

  return <XR store={xrStore}>{children}</XR>
}
