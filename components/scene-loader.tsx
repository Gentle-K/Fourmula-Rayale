"use client"
import dynamic from "next/dynamic"

export const HabitatSceneClient = dynamic(
  () => import("./scene/habitat-scene").then((m) => m.HabitatScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-lg border border-border bg-[#070b16] text-xs text-muted-foreground">
        加载 3D 仿真环境 ...
      </div>
    ),
  },
)
