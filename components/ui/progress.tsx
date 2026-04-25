import * as React from "react"
import { cn } from "@/lib/utils"

export function Progress({
  value,
  className,
  variant = "primary",
}: {
  value: number
  className?: string
  variant?: "primary" | "accent" | "success"
}) {
  const v = Math.max(0, Math.min(100, value))
  const fill =
    variant === "accent" ? "bg-accent" : variant === "success" ? "bg-emerald-500" : "bg-primary"
  return (
    <div className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-secondary", className)}>
      <div
        className={cn("absolute inset-y-0 left-0 transition-[width] duration-300", fill)}
        style={{ width: `${v}%` }}
      />
    </div>
  )
}
