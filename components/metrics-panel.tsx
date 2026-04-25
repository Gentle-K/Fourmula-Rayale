"use client"
import useSWR from "swr"
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { fmt } from "@/lib/utils"

type Metrics = {
  total: number
  success: number
  successRate: number
  avgReturn: number
  avgEnergy: number
  last20Success: number
  byMode: Record<string, { total: number; success: number; avgReturn: number }>
  byTask: Record<string, { name: string; total: number; success: number; difficulty: number }>
  series: { i: number; reward: number; successRate: number; energy: number }[]
  taskCount: number
  policyCount: number
  assetCount: number
}

const fetcher = (u: string) => fetch(u).then((r) => r.json())

export function MetricsPanel() {
  const { data } = useSWR<Metrics>("/api/metrics", fetcher, { refreshInterval: 3500 })
  const m = data ?? {
    total: 0,
    success: 0,
    successRate: 0,
    avgReturn: 0,
    avgEnergy: 0,
    last20Success: 0,
    byMode: {},
    byTask: {},
    series: [],
    taskCount: 0,
    policyCount: 0,
    assetCount: 0,
  }

  const byMode = Object.entries(m.byMode)
  const byTask = Object.entries(m.byTask).sort((a, b) => a[1].difficulty - b[1].difficulty)

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Episodes" value={m.total} hint={`${m.success} 成功`} />
        <Stat label="成功率" value={`${Math.round(m.successRate * 100)}%`} hint={`近20: ${Math.round(m.last20Success * 100)}%`} />
        <Stat label="平均回报" value={fmt(m.avgReturn)} hint={`能耗 ${fmt(m.avgEnergy)}`} />
        <Stat label="规模" value={m.taskCount} hint={`policy ${m.policyCount} · asset ${m.assetCount}`} />
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <CardTitle>滚动成功率</CardTitle>
              <CardDescription>10-episode 滑动窗口</CardDescription>
            </div>
            <Badge variant="outline">{m.series.length} pts</Badge>
          </div>
          <div className="h-32 w-full">
            <ResponsiveContainer>
              <AreaChart data={m.series}>
                <defs>
                  <linearGradient id="grad-succ" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="i" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis domain={[0, 1]} stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    fontSize: 12,
                    borderRadius: 6,
                  }}
                  formatter={(v) => `${Math.round(Number(v ?? 0) * 100)}%`}
                />
                <Area type="monotone" dataKey="successRate" stroke="hsl(var(--primary))" fill="url(#grad-succ)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <CardTitle>每集回报</CardTitle>
            <Badge variant="outline">avg {fmt(m.avgReturn)}</Badge>
          </div>
          <div className="h-32 w-full">
            <ResponsiveContainer>
              <LineChart data={m.series}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="i" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    fontSize: 12,
                    borderRadius: 6,
                  }}
                />
                <Line type="monotone" dataKey="reward" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardContent className="p-3">
            <CardTitle className="mb-2">按模式</CardTitle>
            {byMode.length === 0 ? (
              <div className="text-xs text-muted-foreground">暂无数据</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {byMode.map(([mode, v]) => (
                  <div key={mode} className="flex items-center gap-2 text-xs">
                    <Badge variant="secondary" className="w-20 justify-center">
                      {mode}
                    </Badge>
                    <div className="flex-1 tabular text-muted-foreground">
                      {v.total} ep · avg {fmt(v.avgReturn)}
                    </div>
                    <div className="tabular text-emerald-400">{Math.round((v.success / v.total) * 100)}%</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <CardTitle className="mb-2">按任务（含难度）</CardTitle>
            {byTask.length === 0 ? (
              <div className="text-xs text-muted-foreground">暂无数据</div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-40 overflow-auto scrollbar-thin">
                {byTask.map(([id, v]) => (
                  <div key={id} className="flex items-center gap-2 text-xs">
                    <span className="w-12 tabular text-muted-foreground">d {v.difficulty.toFixed(2)}</span>
                    <span className="flex-1 truncate font-mono">{v.name}</span>
                    <span className="tabular text-muted-foreground">{v.total}</span>
                    <span className="tabular text-emerald-400">{Math.round((v.success / Math.max(1, v.total)) * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-xl tabular text-foreground">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  )
}
