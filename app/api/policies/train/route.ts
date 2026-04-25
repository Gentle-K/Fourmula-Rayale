import { store } from "@/lib/server-store"
import { trainCEM, clonePolicy } from "@/lib/policy"
import type { TaskSpec } from "@/lib/types"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const s = store()
  const body = await req.json().catch(() => ({}))
  const { policyId, taskIds, iterations = 10, populationSize = 16 } = body ?? {}

  const base = policyId ? s.policies.get(policyId) : Array.from(s.policies.values())[0]
  if (!base) return new Response(JSON.stringify({ error: "no base policy" }), { status: 400 })

  const tasks: TaskSpec[] = (taskIds && taskIds.length
    ? (taskIds as string[]).map((id) => s.tasks.get(id)).filter(Boolean)
    : Array.from(s.tasks.values()).slice(0, 3)) as TaskSpec[]

  if (tasks.length === 0) return new Response(JSON.stringify({ error: "no tasks" }), { status: 400 })

  const taskSet = new Set(tasks.map((t) => t.id))
  const imitationSamples = Array.from(s.episodes.values())
    .filter((episode) => taskSet.has(episode.taskId) && episode.interventions?.length)
    .flatMap((episode) =>
      episode.interventions!.flatMap((intervention) =>
        episode.steps
          .filter((step) => step.t >= intervention.startedAtStep && step.t <= intervention.endedAtStep)
          .map((step) => step.action),
      ),
    )
    .slice(-240)

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`))

      send({ type: "start", iterations, populationSize, tasks: tasks.map((t) => t.id) })

      try {
        const trained = clonePolicy(base)
        let last: any = null
        for (const update of trainCEM(trained, tasks, {
          iterations,
          populationSize,
          imitationSamples,
          imitationWeight: imitationSamples.length > 0 ? 0.015 : 0,
        })) {
          last = update
          send({
            type: "iter",
            iter: update.iter,
            total: update.total,
            eliteAvg: update.eliteAvg,
            best: update.best,
            successRate: update.successRate,
            imitationSamples: imitationSamples.length,
          })
        }
        if (last?.bestPolicy) {
          const p = last.bestPolicy
          p.taskFamily = tasks.map((t) => t.id)
          p.iterations = (base.iterations ?? 0) + iterations
          s.policies.set(p.id, p)
          send({ type: "done", policy: p })
        } else {
          send({ type: "done" })
        }
      } catch (err: any) {
        send({ type: "error", error: err?.message ?? "training failed" })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
