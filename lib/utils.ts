import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function fmt(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "—"
  return n.toFixed(digits)
}

export function shortId() {
  return Math.random().toString(36).slice(2, 8)
}
