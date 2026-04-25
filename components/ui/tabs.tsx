"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

type Ctx = { value: string; setValue: (v: string) => void }
const TabsCtx = React.createContext<Ctx | null>(null)

export function Tabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string
  onValueChange: (v: string) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <TabsCtx.Provider value={{ value, setValue: onValueChange }}>
      <div className={className}>{children}</div>
    </TabsCtx.Provider>
  )
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-md bg-secondary p-1", className)}>{children}</div>
  )
}

export function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const ctx = React.useContext(TabsCtx)!
  const active = ctx.value === value
  return (
    <button
      onClick={() => ctx.setValue(value)}
      className={cn(
        "rounded px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const ctx = React.useContext(TabsCtx)!
  if (ctx.value !== value) return null
  return <div className={className}>{children}</div>
}
