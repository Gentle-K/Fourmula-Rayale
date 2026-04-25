"use client"

import { useHabitat } from "@/lib/store"
import { ManualMode } from "@/components/modes/manual-mode"
import { ReplayMode } from "@/components/modes/replay-mode"
import { LearnMode } from "@/components/modes/learn-mode"
import { AutoMode } from "@/components/modes/auto-mode"
import { CurriculumMode } from "@/components/modes/curriculum-mode"

export function ModePanel() {
  const mode = useHabitat((s) => s.mode)
  switch (mode) {
    case "manual":
      return <ManualMode />
    case "replay":
      return <ReplayMode />
    case "learn":
      return <LearnMode />
    case "auto":
      return <AutoMode />
    case "curriculum":
      return <CurriculumMode />
  }
}
