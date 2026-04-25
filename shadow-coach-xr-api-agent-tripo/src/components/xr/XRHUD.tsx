"use client";

import { LoaderCircle, RefreshCcw, ScanSearch, SkipForward, Sparkles, WandSparkles } from "lucide-react";

import { XR_PHASE_LABELS } from "@/lib/xr/xrConstants";
import { XRMetricSnapshot, XRMode, XRTaskPhase } from "@/lib/xr/taskTypes";

type XRHUDProps = {
  mode: XRMode;
  phase: XRTaskPhase;
  metrics: XRMetricSnapshot;
  objective: string;
  latestAssetStatus: string;
  latestAssetTaskId: string | null;
  isLoadingLatestAsset: boolean;
  onModeChange: (mode: XRMode) => void;
  onReset: () => void;
  onNextPhase: () => void;
  onLoadLatestAsset: () => void;
};

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

export default function XRHUD({
  mode,
  phase,
  metrics,
  objective,
  latestAssetStatus,
  latestAssetTaskId,
  isLoadingLatestAsset,
  onModeChange,
  onReset,
  onNextPhase,
  onLoadLatestAsset,
}: XRHUDProps) {
  return (
    <div className="pointer-events-auto absolute inset-x-4 bottom-4 z-20 grid gap-4 lg:inset-x-auto lg:left-4 lg:right-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <section className="rounded-[28px] border border-white/10 bg-slate-950/72 p-5 shadow-[0_20px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-sky-200/80">
              Orbital Skill Habitat XR HUD
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {XR_PHASE_LABELS[phase]}
            </h2>
          </div>
          <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-100">
            {mode}
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{objective}</p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onModeChange("manual")}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
              mode === "manual"
                ? "border-white/20 bg-white/12 text-white"
                : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            Manual Mode
          </button>
          <button
            type="button"
            onClick={() => onModeChange("replay")}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
              mode === "replay"
                ? "border-sky-400/25 bg-sky-400/14 text-sky-100"
                : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            }`}
          >
            <RefreshCcw className="h-4 w-4" />
            Replay Demo
          </button>
          <button
            type="button"
            onClick={() => onModeChange("autonomous")}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
              mode === "autonomous"
                ? "border-violet-400/25 bg-violet-400/14 text-violet-100"
                : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            }`}
          >
            <WandSparkles className="h-4 w-4" />
            Autonomous Demo
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onNextPhase}
            disabled={mode !== "manual"}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <SkipForward className="h-4 w-4" />
            Next Phase
          </button>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-slate-950/72 p-5 shadow-[0_20px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricCard label="Success Rate" value={`${Math.round(metrics.successRate * 100)}%`} />
          <MetricCard label="Elapsed" value={`${metrics.elapsedSeconds.toFixed(1)}s`} />
          <MetricCard label="Collisions" value={`${metrics.collisions}`} />
          <MetricCard label="Fuel" value={`${metrics.fuelUsed.toFixed(1)} u`} />
          <MetricCard label="Grasp Stability" value={`${Math.round(metrics.graspStability * 100)}%`} />
          <MetricCard label="Wipe Coverage" value={`${Math.round(metrics.wipeCoverage * 100)}%`} />
        </div>
        <div className="mt-3 rounded-2xl border border-emerald-400/16 bg-emerald-400/8 px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">Final Score</div>
          <div className="mt-2 text-3xl font-semibold text-white">{metrics.finalScore}</div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Tripo Asset Bridge
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-200">{latestAssetStatus}</div>
              {latestAssetTaskId ? (
                <div className="mt-1 text-xs text-slate-400">Task: {latestAssetTaskId}</div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onLoadLatestAsset}
              disabled={isLoadingLatestAsset}
              className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/12 px-4 py-2 text-sm text-sky-100 transition hover:bg-sky-400/18 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingLatestAsset ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ScanSearch className="h-4 w-4" />
              )}
              Load Latest Tripo Asset
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
