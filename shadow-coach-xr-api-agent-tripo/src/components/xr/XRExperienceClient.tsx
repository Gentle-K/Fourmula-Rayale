"use client";

import Link from "next/link";
import { Loader } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { XR, createXRStore } from "@react-three/xr";
import { ArrowLeft, Boxes, Compass, Headset, ScanSearch } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import XRControlsHelp from "@/components/xr/XRControlsHelp";
import XRHUD from "@/components/xr/XRHUD";
import XRScene from "@/components/xr/XRScene";
import WebXRSupportNotice from "@/components/xr/WebXRSupportNotice";
import {
  XR_CAMERA_POSITION,
  XR_LOADING_TEXT,
  XR_PHASE_DURATION_MS,
} from "@/lib/xr/xrConstants";
import { getMetricsForPhase, MOCK_XR_EPISODE } from "@/lib/xr/mockEpisode";
import { TripoCacheEntry } from "@/lib/types";
import { XRMode } from "@/lib/xr/taskTypes";

const store = createXRStore();

function getLatestSuccessfulAsset(tasks: TripoCacheEntry[]) {
  return tasks.find((task) => task.modelUrl && task.status === "success") ?? null;
}

export default function XRExperienceClient() {
  const [mode, setMode] = useState<XRMode>("manual");
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [playbackNonce, setPlaybackNonce] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [supportMessage, setSupportMessage] = useState(
    "Checking WebXR support. Desktop preview stays available either way.",
  );
  const [vrSupported, setVrSupported] = useState(false);
  const [arSupported, setArSupported] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isLoadingLatestAsset, setIsLoadingLatestAsset] = useState(false);
  const [latestAssetUrl, setLatestAssetUrl] = useState<string | null>(null);
  const [latestAssetTaskId, setLatestAssetTaskId] = useState<string | null>(null);
  const [latestAssetStatus, setLatestAssetStatus] = useState(
    "No cached Tripo asset loaded yet. Use the cache bridge when you have a recent generated model URL.",
  );

  const currentStep =
    MOCK_XR_EPISODE.steps[Math.min(phaseIndex, MOCK_XR_EPISODE.steps.length - 1)];
  const baseMetrics = useMemo(
    () => getMetricsForPhase(currentStep.phase),
    [currentStep.phase],
  );
  const metrics = useMemo(
    () => ({
      ...baseMetrics,
      elapsedSeconds,
    }),
    [baseMetrics, elapsedSeconds],
  );

  useEffect(() => {
    let cancelled = false;

    async function checkSupport() {
      if (typeof window === "undefined") {
        return;
      }

      if (!("xr" in navigator) || !navigator.xr) {
        if (!cancelled) {
          setSupportMessage(
            "WebXR is not available in this browser. Desktop preview is still available.",
          );
          setVrSupported(false);
          setArSupported(false);
        }

        return;
      }

      try {
        const [vr, ar] = await Promise.all([
          navigator.xr.isSessionSupported("immersive-vr"),
          navigator.xr.isSessionSupported("immersive-ar"),
        ]);

        if (!cancelled) {
          setVrSupported(vr);
          setArSupported(ar);
          setSupportMessage(
            vr
              ? "WebXR immersive VR is available. Desktop preview remains active outside headset sessions."
              : "navigator.xr is available, but immersive VR is not supported on this device. Desktop preview is still available.",
          );
        }
      } catch (error) {
        if (!cancelled) {
          setSupportMessage(
            "WebXR support could not be confirmed automatically. Desktop preview is still available.",
          );
          setSessionError(
            error instanceof Error ? error.message : "Unable to verify XR session support.",
          );
        }
      }
    }

    void checkSupport();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode === "manual") {
      return;
    }

    const startedAt = performance.now();

    const interval = window.setInterval(() => {
      const elapsedMs = performance.now() - startedAt;
      const nextIndex = Math.min(
        MOCK_XR_EPISODE.steps.length - 1,
        Math.floor(elapsedMs / XR_PHASE_DURATION_MS),
      );

      setPhaseIndex(nextIndex);
      setElapsedSeconds(Number((elapsedMs / 1000).toFixed(1)));

      if (nextIndex === MOCK_XR_EPISODE.steps.length - 1) {
        window.clearInterval(interval);
      }
    }, 120);

    return () => {
      window.clearInterval(interval);
    };
  }, [mode, playbackNonce]);

  const handleModeChange = (nextMode: XRMode) => {
    setMode(nextMode);
    setPhaseIndex(0);
    setElapsedSeconds(0);
    setSessionError(null);
    setPlaybackNonce((value) => value + 1);
  };

  const handleReset = () => {
    setMode("manual");
    setPhaseIndex(0);
    setElapsedSeconds(0);
    setSessionError(null);
  };

  const handleNextPhase = () => {
    setPhaseIndex((value) => Math.min(value + 1, MOCK_XR_EPISODE.steps.length - 1));
    setElapsedSeconds(
      MOCK_XR_EPISODE.steps[Math.min(phaseIndex + 1, MOCK_XR_EPISODE.steps.length - 1)]?.time ?? 0,
    );
  };

  const handleEnterSession = async (sessionMode: "immersive-vr" | "immersive-ar") => {
    try {
      setSessionError(null);

      if (sessionMode === "immersive-vr") {
        await store.enterVR();
        return;
      }

      await store.enterAR();
    } catch (error) {
      setSessionError(
        error instanceof Error
          ? error.message
          : `Unable to enter ${sessionMode === "immersive-vr" ? "VR" : "AR"} session.`,
      );
    }
  };

  const handleLoadLatestAsset = async () => {
    try {
      setIsLoadingLatestAsset(true);
      setLatestAssetStatus("Reading /api/tripo/cache for the latest successful asset...");

      const response = await fetch("/api/tripo/cache", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Cache request failed with status ${response.status}.`);
      }

      const payload = (await response.json()) as {
        ok: boolean;
        tasks?: TripoCacheEntry[];
      };

      if (!payload.ok || !Array.isArray(payload.tasks)) {
        throw new Error("Cache response shape was invalid.");
      }

      const latestAsset = getLatestSuccessfulAsset(payload.tasks);

      if (!latestAsset || !latestAsset.modelUrl) {
        setLatestAssetUrl(null);
        setLatestAssetTaskId(null);
        setLatestAssetStatus(
          "No successful cached Tripo asset with a model URL was found yet. Generate one in /tripo first.",
        );
        return;
      }

      setLatestAssetUrl(latestAsset.modelUrl);
      setLatestAssetTaskId(latestAsset.taskId);
      setLatestAssetStatus(
        `Loaded latest cached asset from task ${latestAsset.taskId}. The scene now attempts to render its model URL.`,
      );
    } catch (error) {
      setLatestAssetStatus(
        error instanceof Error ? error.message : "Unable to load the latest cached Tripo asset.",
      );
    } finally {
      setIsLoadingLatestAsset(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#172554_0%,#020617_58%,#020617_100%)] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(56,189,248,0.12),transparent_32%,transparent_68%,rgba(56,189,248,0.08))]" />

      <div className="pointer-events-auto absolute inset-x-4 top-4 z-20 flex flex-col gap-4 lg:inset-x-auto lg:left-4 lg:right-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-white/10 bg-slate-950/72 px-5 py-4 shadow-[0_20px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-sky-200/80">
              Orbital Skill Habitat XR
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              WebXR maintenance demo shell for desktop preview and headset entry
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
              This route is a stable integration shell: React Three Fiber scene,
              WebXR session entry, lightweight mock episode playback, and optional
              Tripo asset loading from secure server-side cache routes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Back Home
            </Link>
            <Link
              href="/tripo"
              className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/12 px-4 py-2 text-sm text-sky-100 transition hover:bg-sky-400/18"
            >
              <Boxes className="h-4 w-4" />
              Back to Tripo Debug
            </Link>
            <button
              type="button"
              onClick={() => void handleEnterSession("immersive-vr")}
              disabled={!vrSupported}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/12 px-4 py-2 text-sm text-emerald-100 transition hover:bg-emerald-400/18 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Headset className="h-4 w-4" />
              Enter VR
            </button>
            <button
              type="button"
              onClick={() => void handleEnterSession("immersive-ar")}
              disabled={!arSupported}
              className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/12 px-4 py-2 text-sm text-violet-100 transition hover:bg-violet-400/18 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Compass className="h-4 w-4" />
              Enter AR
            </button>
            <button
              type="button"
              onClick={handleLoadLatestAsset}
              disabled={isLoadingLatestAsset}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ScanSearch className="h-4 w-4" />
              Asset Cache
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <WebXRSupportNotice
            supportMessage={supportMessage}
            vrSupported={vrSupported}
            arSupported={arSupported}
            sessionError={sessionError}
          />
          <XRControlsHelp />
        </div>
      </div>

      <div className="relative h-screen w-full pt-[15.5rem] lg:pt-[13rem]">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: XR_CAMERA_POSITION, fov: 50 }}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        >
          <XR store={store}>
            <XRScene
              currentStep={currentStep}
              latestAssetUrl={latestAssetUrl}
              phase={currentStep.phase}
            />
          </XR>
        </Canvas>
      </div>

      <XRHUD
        mode={mode}
        phase={currentStep.phase}
        metrics={metrics}
        objective={MOCK_XR_EPISODE.objective}
        latestAssetStatus={latestAssetStatus}
        latestAssetTaskId={latestAssetTaskId}
        isLoadingLatestAsset={isLoadingLatestAsset}
        onModeChange={handleModeChange}
        onReset={handleReset}
        onNextPhase={handleNextPhase}
        onLoadLatestAsset={handleLoadLatestAsset}
      />

      <Loader
        containerStyles={{
          background:
            "linear-gradient(180deg, rgba(2,6,23,0.92) 0%, rgba(2,6,23,0.86) 100%)",
        }}
        innerStyles={{
          width: "min(420px, calc(100vw - 48px))",
          color: "#e2e8f0",
        }}
        barStyles={{
          backgroundColor: "#38bdf8",
        }}
        dataStyles={{
          color: "#e2e8f0",
          fontSize: "0.75rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
        dataInterpolation={(progress) => `${XR_LOADING_TEXT} ${progress.toFixed(0)}%`}
      />
    </main>
  );
}
