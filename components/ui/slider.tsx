"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

type Props = {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  className?: string
  format?: (v: number) => string
  bipolar?: boolean
}

export function Slider({
  value,
  onChange,
  min = -1,
  max = 1,
  step = 0.01,
  label,
  className,
  format,
  bipolar = true,
}: Props) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <label className={cn("flex flex-col gap-1 text-xs", className)}>
      {label !== undefined && (
        <div className="flex items-center justify-between text-muted-foreground">
          <span>{label}</span>
          <span className="tabular text-foreground">{format ? format(value) : value.toFixed(2)}</span>
        </div>
      )}
      <div className="relative h-1.5 rounded-full bg-secondary">
        <div
          className={cn(
            "absolute top-0 h-full rounded-full",
            bipolar ? "bg-primary/60" : "bg-primary",
          )}
          style={
            bipolar
              ? {
                  left: `${Math.min(50, pct)}%`,
                  width: `${Math.abs(pct - 50)}%`,
                }
              : { left: 0, width: `${pct}%` }
          }
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number.parseFloat(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent
            [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-primary
            [&::-webkit-slider-thumb]:shadow-[0_0_0_2px_hsl(220_30%_6%)]"
        />
      </div>
    </label>
  )
}
