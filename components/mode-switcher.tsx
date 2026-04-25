"use client"

import { useHabitat } from "@/lib/store"
import type { ControlMode } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Hand, Repeat, GraduationCap, Bot, ListOrdered } from "lucide-react"

const modes: { value: ControlMode; label: string; icon: typeof Hand; hint: string }[] = [
  { value: "manual", label: "Manual", icon: Hand, hint: "Teleop · record demos" },
  { value: "replay", label: "Replay", icon: Repeat, hint: "Inspect episodes" },
  { value: "learn", label: "Learn", icon: GraduationCap, hint: "Train policy" },
  { value: "auto", label: "Auto", icon: Bot, hint: "Run learned policy" },
  { value: "curriculum", label: "Curriculum", icon: ListOrdered, hint: "Generalize" },
]

export function ModeSwitcher() {
  const mode = useHabitat((s) => s.mode)
  const setMode = useHabitat((s) => s.setMode)

  return (
    <div className="grid grid-cols-5 gap-1.5 rounded-xl border border-border/60 bg-card/60 p-1.5">
      {modes.map((m) => {
        const Icon = m.icon
        const active = mode === m.value
        return (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={cn(
              "group flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-center transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="text-[11px] font-medium uppercase tracking-wider">{m.label}</span>
            <span
              className={cn(
                "hidden text-[9px] leading-tight md:block",
                active ? "text-primary-foreground/70" : "text-muted-foreground/70",
              )}
            >
              {m.hint}
            </span>
          </button>
        )
      })}
    </div>
  )
}
