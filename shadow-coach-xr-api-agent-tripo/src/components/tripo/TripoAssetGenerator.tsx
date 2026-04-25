"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Bot,
  Copy,
  ExternalLink,
  FileImage,
  LoaderCircle,
  Mic,
  RefreshCcw,
  Server,
  ShieldCheck,
  Sparkles,
  Square,
  Upload,
  X,
} from "lucide-react";

import { getRecommendedPipelineMode } from "@/lib/tripoAssetClassify";
import {
  TRIPO_ANIMATION_PRESETS,
  TRIPO_ANIMATION_PRESET_ORDER,
} from "@/lib/tripoAnimationPresets";
import {
  RIGGABLE_ASSET_PRESETS,
  RIGGABLE_ASSET_PRESET_ORDER,
  STATIC_ASSET_PRESETS,
  STATIC_ASSET_PRESET_ORDER,
} from "@/lib/tripoPresets";
import {
  isFinalTripoStatus,
  TripoAnimationPresetId,
  TripoAnimationStatus,
  TripoAssetType,
  TripoCacheEntry,
  TripoInputMode,
  TripoPipelineMode,
  TripoReferenceImage,
  TripoRigStatus,
  TripoTaskStatus,
  TRIPO_MAX_PROMPT_LENGTH,
  TRIPO_REFERENCE_IMAGE_ACCEPT,
  TRIPO_REFERENCE_IMAGE_ACCEPTED_MIME_TYPES,
  TRIPO_REFERENCE_IMAGE_MAX_BYTES,
} from "@/lib/types";

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const VOICE_READY_TEXT = "Ready";
const VOICE_UNSUPPORTED_TEXT = "Voice input unsupported in this browser";
const VOICE_LISTENING_TEXT = "Listening...";
const VOICE_RECEIVED_TEXT = "Transcript received";

type VoiceLanguage = "en-US" | "zh-CN";

type GenerateApiResponse =
  | {
      ok: true;
      mock: boolean;
      inputMode: TripoInputMode;
      referenceImage: TripoReferenceImage | null;
      taskId: string;
      status: TripoTaskStatus;
      prompt: string;
      assetType?: TripoAssetType;
      assetCategory?: "static" | "riggable";
      rigStatus?: TripoRigStatus;
      message: string;
      raw: Record<string, unknown>;
    }
  | {
      ok: false;
      error: string;
    };

type TaskApiResponse =
  | {
      ok: true;
      cached: boolean;
      mock: boolean;
      taskId: string;
      status: TripoTaskStatus;
      modelUrl: string | null;
      raw: Record<string, unknown>;
    }
  | {
      ok: false;
      error: string;
    };

type CacheApiResponse = {
  ok: true;
  count: number;
  ttlSeconds: number;
  tasks: TripoCacheEntry[];
};

type ActiveTask = {
  taskId: string;
  status: TripoTaskStatus;
  mock: boolean;
  inputMode: TripoInputMode;
  referenceImage: TripoReferenceImage | null;
  modelUrl: string | null;
  prompt: string;
  message: string;
  raw: Record<string, unknown>;
  cached: boolean;
};

type RiggableGenerateApiResponse =
  | {
      ok: true;
      mock: boolean;
      assetCategory: "riggable";
      assetType: TripoAssetType;
      pipelineMode: TripoPipelineMode;
      generateTaskId: string;
      status: TripoTaskStatus;
      rigStatus: TripoRigStatus;
      message: string;
      raw: Record<string, unknown>;
    }
  | {
      ok: false;
      error: string;
    };

type RiggableRigApiResponse =
  | {
      ok: true;
      mock: boolean;
      assetCategory: "riggable";
      assetType: TripoAssetType;
      pipelineMode: TripoPipelineMode;
      generateTaskId?: string;
      rigTaskId: string;
      status: TripoAnimationStatus;
      rigStatus: TripoRigStatus;
      message: string;
      raw: Record<string, unknown>;
    }
  | {
      ok: false;
      error: string;
    };

type RiggableAnimateApiResponse =
  | {
      ok: true;
      mock: boolean;
      assetCategory: "riggable";
      assetType: TripoAssetType;
      pipelineMode: TripoPipelineMode;
      animationTaskId: string;
      status: TripoAnimationStatus;
      rigStatus: TripoRigStatus;
      message: string;
      raw: Record<string, unknown>;
    }
  | {
      ok: false;
      error: string;
    };

type AnimationTaskApiResponse =
  | {
      ok: true;
      cached: boolean;
      mock: boolean;
      taskId: string;
      status: TripoAnimationStatus;
      rigStatus: TripoRigStatus;
      modelUrl: string | null;
      riggedModelUrl: string | null;
      animatedModelUrl: string | null;
      raw: Record<string, unknown>;
    }
  | {
      ok: false;
      error: string;
    };

type RiggablePipelineState = {
  assetType: TripoAssetType;
  pipelineMode: TripoPipelineMode;
  animationPresetId: TripoAnimationPresetId;
  mock: boolean;
  generateTaskId: string | null;
  generateStatus: TripoTaskStatus | null;
  modelUrl: string | null;
  rigTaskId: string | null;
  rigTaskStatus: TripoAnimationStatus | null;
  riggedModelUrl: string | null;
  animationTaskId: string | null;
  animationTaskStatus: TripoAnimationStatus | null;
  animatedModelUrl: string | null;
  rigStatus: TripoRigStatus;
  raw: Record<string, unknown>;
};

function getRawNumber(raw: Record<string, unknown>, path: string[]) {
  let current: unknown = raw;

  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "number" && Number.isFinite(current) ? current : null;
}

function getProgress(raw: Record<string, unknown>) {
  return (
    getRawNumber(raw, ["progress"]) ??
    getRawNumber(raw, ["data", "progress"]) ??
    getRawNumber(raw, ["result", "progress"])
  );
}

function getPromptFromRaw(raw: Record<string, unknown>) {
  const candidates = [raw.prompt, raw.input, raw.request, raw.data, raw.result];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }

    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const record = candidate as Record<string, unknown>;
      const prompt = record.prompt;

      if (typeof prompt === "string" && prompt.trim().length > 0) {
        return prompt.trim();
      }

      if (
        record.input &&
        typeof record.input === "object" &&
        !Array.isArray(record.input)
      ) {
        const nestedPrompt = (record.input as Record<string, unknown>).prompt;

        if (typeof nestedPrompt === "string" && nestedPrompt.trim().length > 0) {
          return nestedPrompt.trim();
        }
      }
    }
  }

  return "";
}

function getStatusClasses(status: TripoTaskStatus) {
  switch (status) {
    case "success":
      return "border-emerald-500/30 bg-emerald-500/12 text-emerald-200";
    case "failed":
    case "banned":
    case "expired":
    case "cancelled":
      return "border-rose-500/30 bg-rose-500/12 text-rose-200";
    case "running":
      return "border-sky-500/30 bg-sky-500/12 text-sky-200";
    default:
      return "border-amber-500/30 bg-amber-500/12 text-amber-100";
  }
}

function getVoiceStatusClasses(statusText: string) {
  if (statusText === VOICE_LISTENING_TEXT) {
    return "border-sky-400/20 bg-sky-400/10 text-sky-100";
  }

  if (statusText === VOICE_RECEIVED_TEXT || statusText === VOICE_READY_TEXT) {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
  }

  if (
    statusText === VOICE_UNSUPPORTED_TEXT ||
    statusText.startsWith("Voice input error:")
  ) {
    return "border-amber-400/20 bg-amber-400/10 text-amber-100";
  }

  return "border-white/12 bg-white/6 text-slate-200";
}

function shortTaskId(taskId: string) {
  return taskId.length > 18
    ? `${taskId.slice(0, 8)}...${taskId.slice(-6)}`
    : taskId;
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${bytes} B`;
}

function getEntryInputMode(entry: TripoCacheEntry): TripoInputMode {
  if (entry.inputMode) {
    return entry.inputMode;
  }

  const type =
    typeof entry.raw.type === "string"
      ? entry.raw.type
      : typeof (entry.raw.data as Record<string, unknown> | undefined)?.type ===
          "string"
        ? ((entry.raw.data as Record<string, unknown>).type as string)
        : "";

  return type === "image_to_model" ? "image" : "text";
}

function getDefaultAnimationPresetForAsset(
  assetType: TripoAssetType,
): TripoAnimationPresetId {
  switch (assetType) {
    case "astronaut":
    case "humanoid_guide":
      return "guide_wave";
    case "assistant_robot":
    case "small_creature":
    default:
      return "robot_idle";
  }
}

function getRiggablePresetIdForAssetType(
  assetType?: TripoAssetType,
): (typeof RIGGABLE_ASSET_PRESET_ORDER)[number] {
  switch (assetType) {
    case "astronaut":
      return "ASTRONAUT_GUIDE";
    case "humanoid_guide":
      return "HUMANOID_GUIDE";
    case "small_creature":
      return "SMALL_CREATURE_ROBOT";
    case "assistant_robot":
    default:
      return "ASSISTANT_ROBOT";
  }
}

function looksLikeRiggablePrompt(prompt: string) {
  return /\b(robot|astronaut|humanoid|guide|creature|character)\b/i.test(
    prompt,
  );
}

function clampPromptText(value: string) {
  const normalizedValue = value.replace(/\s+/g, " ").trim();

  if (normalizedValue.length <= TRIPO_MAX_PROMPT_LENGTH) {
    return {
      value: normalizedValue,
      truncated: false,
    };
  }

  return {
    value: normalizedValue.slice(0, TRIPO_MAX_PROMPT_LENGTH).trimEnd(),
    truncated: true,
  };
}

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function getVoiceInputErrorMessage(error: string) {
  switch (error) {
    case "not-allowed":
      return "Microphone permission was denied.";
    case "service-not-allowed":
      return "Speech recognition is not allowed in this browser.";
    case "no-speech":
      return "No speech was detected.";
    case "audio-capture":
      return "No microphone was found for audio capture.";
    case "network":
      return "The browser speech recognition service had a network error.";
    case "aborted":
      return "Voice input was stopped.";
    default:
      return error || "Unable to recognize speech.";
  }
}

export default function TripoAssetGenerator() {
  const [selectedPreset, setSelectedPreset] =
    useState<(typeof STATIC_ASSET_PRESET_ORDER)[number]>("ISS_MODULE");
  const [prompt, setPrompt] = useState(STATIC_ASSET_PRESETS.ISS_MODULE.prompt);
  const [selectedRiggablePreset, setSelectedRiggablePreset] =
    useState<(typeof RIGGABLE_ASSET_PRESET_ORDER)[number]>("ASSISTANT_ROBOT");
  const [riggablePrompt, setRiggablePrompt] = useState(
    RIGGABLE_ASSET_PRESETS.ASSISTANT_ROBOT.prompt,
  );
  const [riggablePipelineMode, setRiggablePipelineMode] =
    useState<TripoPipelineMode>(
      RIGGABLE_ASSET_PRESETS.ASSISTANT_ROBOT.defaultPipelineMode ??
        "generate_then_rig",
    );
  const [selectedAnimationPresetId, setSelectedAnimationPresetId] =
    useState<TripoAnimationPresetId>("robot_idle");
  const [referenceImageFile, setReferenceImageFile] = useState<File | null>(null);
  const [referenceImagePreviewUrl, setReferenceImagePreviewUrl] = useState<
    string | null
  >(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [activeTask, setActiveTask] = useState<ActiveTask | null>(null);
  const [cacheEntries, setCacheEntries] = useState<TripoCacheEntry[]>([]);
  const [ttlSeconds, setTtlSeconds] = useState(3600);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<string | null>(null);
  const [riggableError, setRiggableError] = useState<string | null>(null);
  const [riggableInfo, setRiggableInfo] = useState<string | null>(null);
  const [riggableCopyState, setRiggableCopyState] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [pollStartedAt, setPollStartedAt] = useState<number | null>(null);
  const [riggablePipelineState, setRiggablePipelineState] =
    useState<RiggablePipelineState>({
      assetType: RIGGABLE_ASSET_PRESETS.ASSISTANT_ROBOT.assetType ?? "assistant_robot",
      pipelineMode:
        RIGGABLE_ASSET_PRESETS.ASSISTANT_ROBOT.defaultPipelineMode ??
        "generate_then_rig",
      animationPresetId: "robot_idle",
      mock: false,
      generateTaskId: null,
      generateStatus: null,
      modelUrl: null,
      rigTaskId: null,
      rigTaskStatus: null,
      riggedModelUrl: null,
      animationTaskId: null,
      animationTaskStatus: null,
      animatedModelUrl: null,
      rigStatus: "pending",
      raw: {},
    });
  const [isRiggableGenerating, setIsRiggableGenerating] = useState(false);
  const [isRigging, setIsRigging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isRiggableRefreshing, setIsRiggableRefreshing] = useState(false);
  const [isRiggablePolling, setIsRiggablePolling] = useState(false);
  const [riggablePollStartedAt, setRiggablePollStartedAt] = useState<number | null>(
    null,
  );
  const [voiceLanguage, setVoiceLanguage] = useState<VoiceLanguage>("en-US");
  const [isVoiceSupported, setIsVoiceSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceStatusText, setVoiceStatusText] = useState(VOICE_READY_TEXT);
  const [voiceInterimTranscript, setVoiceInterimTranscript] = useState("");
  const [voiceFinalTranscript, setVoiceFinalTranscript] = useState("");
  const [voicePromptBeforeTranscript, setVoicePromptBeforeTranscript] =
    useState("");
  const [voiceNote, setVoiceNote] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const voiceStatusRef = useRef(VOICE_READY_TEXT);
  const voiceSupportRef = useRef(false);

  function setVoiceStatus(nextStatus: string) {
    voiceStatusRef.current = nextStatus;
    setVoiceStatusText(nextStatus);
  }

  function cleanupRecognition() {
    const recognition = recognitionRef.current;

    if (!recognition) {
      return;
    }

    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognitionRef.current = null;
  }

  useEffect(() => {
    return () => {
      if (referenceImagePreviewUrl) {
        URL.revokeObjectURL(referenceImagePreviewUrl);
      }
    };
  }, [referenceImagePreviewUrl]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const isSupported = Boolean(getSpeechRecognitionConstructor());

      voiceSupportRef.current = isSupported;
      setIsVoiceSupported(isSupported);
      setVoiceStatus(isSupported ? VOICE_READY_TEXT : VOICE_UNSUPPORTED_TEXT);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);

      const recognition = recognitionRef.current;

      if (recognition) {
        cleanupRecognition();
        recognition.stop();
      }
    };
  }, []);

  function applyRiggablePreset(
    nextPresetId: (typeof RIGGABLE_ASSET_PRESET_ORDER)[number],
  ) {
    const preset = RIGGABLE_ASSET_PRESETS[nextPresetId];
    const assetType = preset.assetType ?? "assistant_robot";
    const nextPipelineMode =
      preset.defaultPipelineMode ??
      getRecommendedPipelineMode(assetType, {
        includeAnimation: assetType !== "assistant_robot",
      });
    const nextAnimationPresetId = getDefaultAnimationPresetForAsset(assetType);

    setSelectedRiggablePreset(nextPresetId);
    setRiggablePrompt(preset.prompt);
    setRiggablePipelineMode(nextPipelineMode);
    setSelectedAnimationPresetId(nextAnimationPresetId);
    setRiggablePipelineState({
      assetType,
      pipelineMode: nextPipelineMode,
      animationPresetId: nextAnimationPresetId,
      mock: false,
      generateTaskId: null,
      generateStatus: null,
      modelUrl: null,
      rigTaskId: null,
      rigTaskStatus: null,
      riggedModelUrl: null,
      animationTaskId: null,
      animationTaskStatus: null,
      animatedModelUrl: null,
      rigStatus: "pending",
      raw: {},
    });
    setRiggableError(null);
    setRiggableInfo(null);
    setRiggableCopyState(null);
  }

  const promptLength = prompt.length;
  const trimmedPrompt = prompt.trim();
  const hasReferenceImage = Boolean(referenceImageFile);
  const riggablePromptLength = riggablePrompt.length;
  const trimmedRiggablePrompt = riggablePrompt.trim();
  const canGenerate =
    (trimmedPrompt.length > 0 || hasReferenceImage) &&
    promptLength <= TRIPO_MAX_PROMPT_LENGTH &&
    !isGenerating;
  const canGenerateRiggable =
    trimmedRiggablePrompt.length > 0 &&
    riggablePromptLength <= TRIPO_MAX_PROMPT_LENGTH &&
    !isRiggableGenerating;
  const progress = activeTask ? getProgress(activeTask.raw) : null;
  const currentRiggablePreset = RIGGABLE_ASSET_PRESETS[selectedRiggablePreset];
  const staticPromptLooksRiggable = looksLikeRiggablePrompt(trimmedPrompt);
  const canGenerateStatic =
    canGenerate && (!trimmedPrompt || !staticPromptLooksRiggable);
  const selectedAnimationPreset =
    Object.values(TRIPO_ANIMATION_PRESETS).find(
      (preset) => preset.id === selectedAnimationPresetId,
    ) ?? TRIPO_ANIMATION_PRESETS.ROBOT_IDLE;

  async function refreshCache() {
    const response = await fetch("/api/tripo/cache", {
      cache: "no-store",
    });
    const payload = (await response.json()) as CacheApiResponse;

    if (payload.ok) {
      setCacheEntries(payload.tasks);
      setTtlSeconds(payload.ttlSeconds);
    }
  }

  async function refreshTask(forceRefresh = false) {
    if (!activeTask) {
      return;
    }

    setIsRefreshing(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        taskId: activeTask.taskId,
      });

      if (forceRefresh) {
        params.set("refresh", "1");
      }

      const response = await fetch(`/api/tripo/task?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as TaskApiResponse;

      if (!payload.ok) {
        throw new Error(payload.error);
      }

      setActiveTask((current) =>
        current
          ? {
              ...current,
              taskId: payload.taskId,
              status: payload.status,
              modelUrl: payload.modelUrl,
              mock: payload.mock,
              raw: payload.raw,
              cached: payload.cached,
            }
          : current,
      );

      if (isFinalTripoStatus(payload.status)) {
        setIsPolling(false);
      }

      if (payload.status === "success") {
        setInfo("Generation finished. Model URL is ready for review.");
      }

      await refreshCache();
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Failed to refresh task status.",
      );
      setIsPolling(false);
    } finally {
      setIsRefreshing(false);
    }
  }

  async function refreshRiggableTask(forceRefresh = false) {
    const pipeline = riggablePipelineState;
    const currentAnimationTaskId =
      pipeline.animationTaskId &&
      (forceRefresh ||
        !isFinalTripoStatus(pipeline.animationTaskStatus ?? "queued"))
        ? pipeline.animationTaskId
        : null;
    const currentRigTaskId =
      !currentAnimationTaskId &&
      pipeline.rigTaskId &&
      (forceRefresh ||
        !isFinalTripoStatus(pipeline.rigTaskStatus ?? "queued"))
        ? pipeline.rigTaskId
        : null;
    const currentGenerateTaskId =
      !currentAnimationTaskId &&
      !currentRigTaskId &&
      pipeline.generateTaskId &&
      (forceRefresh ||
        !isFinalTripoStatus(pipeline.generateStatus ?? "queued"))
        ? pipeline.generateTaskId
        : null;

    if (!currentAnimationTaskId && !currentRigTaskId && !currentGenerateTaskId) {
      return;
    }

    setIsRiggableRefreshing(true);
    setRiggableError(null);

    try {
      if (currentAnimationTaskId || currentRigTaskId) {
        const taskId = currentAnimationTaskId ?? currentRigTaskId ?? "";
        const params = new URLSearchParams({
          taskId,
        });

        if (forceRefresh) {
          params.set("refresh", "1");
        }

        const response = await fetch(`/api/tripo/animation/task?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as AnimationTaskApiResponse;

        if (!payload.ok) {
          throw new Error(payload.error);
        }

        setRiggablePipelineState((current) => {
          if (currentAnimationTaskId) {
            return {
              ...current,
              mock: payload.mock,
              animationTaskId: payload.taskId,
              animationTaskStatus: payload.status,
              rigStatus: payload.rigStatus,
              animatedModelUrl: payload.animatedModelUrl,
              raw: payload.raw,
            };
          }

          return {
            ...current,
            mock: payload.mock,
            rigTaskId: payload.taskId,
            rigTaskStatus: payload.status,
            rigStatus: payload.rigStatus,
            riggedModelUrl: payload.riggedModelUrl,
            raw: payload.raw,
          };
        });

        if (isFinalTripoStatus(payload.status)) {
          setIsRiggablePolling(false);
        }

        if (payload.status === "success") {
          setRiggableInfo(
            currentAnimationTaskId
              ? "Animation task finished. Animated model URL is ready for review."
              : "Rig task finished. Rigged model URL is ready for review.",
          );
        }

        await refreshCache();
        return;
      }

      const params = new URLSearchParams({
        taskId: currentGenerateTaskId ?? "",
      });

      if (forceRefresh) {
        params.set("refresh", "1");
      }

      const response = await fetch(`/api/tripo/task?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as TaskApiResponse;

      if (!payload.ok) {
        throw new Error(payload.error);
      }

      setRiggablePipelineState((current) => ({
        ...current,
        mock: payload.mock,
        generateTaskId: payload.taskId,
        generateStatus: payload.status,
        modelUrl: payload.modelUrl,
        raw: payload.raw,
      }));

      if (isFinalTripoStatus(payload.status)) {
        setIsRiggablePolling(false);
      }

      if (payload.status === "success") {
        setRiggableInfo(
          "Riggable model generation finished. You can now start rigging.",
        );
      }

      await refreshCache();
    } catch (refreshError) {
      setRiggableError(
        refreshError instanceof Error
          ? refreshError.message
          : "Failed to refresh riggable pipeline status.",
      );
      setIsRiggablePolling(false);
    } finally {
      setIsRiggableRefreshing(false);
    }
  }

  async function handleGenerate() {
    if (!canGenerateStatic) {
      if (staticPromptLooksRiggable) {
        setError(
          "This prompt looks like a riggable character. Use the Riggable Character Generator below instead of the static props pipeline.",
        );
      }
      return;
    }

    setIsGenerating(true);
    setError(null);
    setInfo(null);
    setCopyState(null);

    try {
      const response = await (async () => {
        if (referenceImageFile) {
          const body = new FormData();

          if (trimmedPrompt) {
            body.append("prompt", trimmedPrompt);
          }

          body.append("image", referenceImageFile);

          return fetch("/api/tripo/generate", {
            method: "POST",
            body,
          });
        }

        return fetch("/api/tripo/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: trimmedPrompt,
          }),
        });
      })();
      const payload = (await response.json()) as GenerateApiResponse;

      if (!payload.ok) {
        throw new Error(payload.error);
      }

      setActiveTask({
        taskId: payload.taskId,
        status: payload.status,
        mock: payload.mock,
        inputMode: payload.inputMode,
        referenceImage: payload.referenceImage,
        modelUrl: null,
        prompt: payload.prompt,
        message: payload.message,
        raw: payload.raw,
        cached: false,
      });
      setPollStartedAt(Date.now());
      setIsPolling(!isFinalTripoStatus(payload.status));
      setInfo(payload.message);

      await refreshCache();
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Failed to create Tripo task.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleGenerateRiggableModel() {
    if (!canGenerateRiggable) {
      return;
    }

    const preset = RIGGABLE_ASSET_PRESETS[selectedRiggablePreset];
    const assetType = preset.assetType ?? "assistant_robot";

    setIsRiggableGenerating(true);
    setRiggableError(null);
    setRiggableInfo(null);
    setRiggableCopyState(null);

    try {
      const response = await fetch("/api/tripo/riggable/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: trimmedRiggablePrompt,
          assetType,
          pipelineMode: riggablePipelineMode,
        }),
      });
      const payload = (await response.json()) as RiggableGenerateApiResponse;

      if (!payload.ok) {
        throw new Error(payload.error);
      }

      setRiggablePipelineState({
        assetType: payload.assetType,
        pipelineMode: riggablePipelineMode,
        animationPresetId: selectedAnimationPresetId,
        mock: payload.mock,
        generateTaskId: payload.generateTaskId,
        generateStatus: payload.status,
        modelUrl: null,
        rigTaskId: null,
        rigTaskStatus: null,
        riggedModelUrl: null,
        animationTaskId: null,
        animationTaskStatus: null,
        animatedModelUrl: null,
        rigStatus: payload.rigStatus,
        raw: payload.raw,
      });
      setRiggablePollStartedAt(Date.now());
      setIsRiggablePolling(!isFinalTripoStatus(payload.status));
      setRiggableInfo(payload.message);

      await refreshCache();
    } catch (generateError) {
      setRiggableError(
        generateError instanceof Error
          ? generateError.message
          : "Failed to create riggable generation task.",
      );
    } finally {
      setIsRiggableGenerating(false);
    }
  }

  async function handleRigGeneratedModel() {
    if (!riggablePipelineState.generateTaskId) {
      setRiggableError("Generate a riggable model before starting rigging.");
      return;
    }

    if (riggablePipelineState.generateStatus !== "success") {
      setRiggableError("Wait for the generated model to finish before rigging.");
      return;
    }

    setIsRigging(true);
    setRiggableError(null);
    setRiggableInfo(null);

    try {
      const response = await fetch("/api/tripo/riggable/rig", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceTaskId: riggablePipelineState.generateTaskId,
          assetType: riggablePipelineState.assetType,
          generateTaskId: riggablePipelineState.generateTaskId,
        }),
      });
      const payload = (await response.json()) as RiggableRigApiResponse;

      if (!payload.ok) {
        throw new Error(payload.error);
      }

      setRiggablePipelineState((current) => ({
        ...current,
        mock: payload.mock,
        rigTaskId: payload.rigTaskId,
        rigTaskStatus: payload.status,
        rigStatus: payload.rigStatus,
        raw: payload.raw,
      }));
      setRiggablePollStartedAt(Date.now());
      setIsRiggablePolling(!isFinalTripoStatus(payload.status));
      setRiggableInfo(payload.message);

      await refreshCache();
    } catch (rigError) {
      setRiggableError(
        rigError instanceof Error ? rigError.message : "Failed to create rig task.",
      );
    } finally {
      setIsRigging(false);
    }
  }

  async function handleAnimateRiggableModel() {
    const sourceTaskId = riggablePipelineState.rigTaskId;

    if (!sourceTaskId) {
      setRiggableError("Rig the generated model before adding animation.");
      return;
    }

    if (riggablePipelineState.rigTaskStatus !== "success") {
      setRiggableError("Wait for rigging to finish before adding animation.");
      return;
    }

    setIsAnimating(true);
    setRiggableError(null);
    setRiggableInfo(null);

    try {
      const response = await fetch("/api/tripo/riggable/animate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceTaskId,
          assetType: riggablePipelineState.assetType,
          animationPresetId: selectedAnimationPresetId,
        }),
      });
      const payload = (await response.json()) as RiggableAnimateApiResponse;

      if (!payload.ok) {
        throw new Error(payload.error);
      }

      setRiggablePipelineState((current) => ({
        ...current,
        mock: payload.mock,
        animationPresetId: selectedAnimationPresetId,
        animationTaskId: payload.animationTaskId,
        animationTaskStatus: payload.status,
        rigStatus: payload.rigStatus,
        raw: payload.raw,
      }));
      setRiggablePollStartedAt(Date.now());
      setIsRiggablePolling(!isFinalTripoStatus(payload.status));
      setRiggableInfo(payload.message);
    } catch (animationError) {
      setRiggableError(
        animationError instanceof Error
          ? animationError.message
          : "Failed to create animation task.",
      );
    } finally {
      setIsAnimating(false);
    }
  }

  async function handleCopyModelUrl() {
    if (!activeTask?.modelUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(activeTask.modelUrl);
      setCopyState("Model URL copied.");
    } catch {
      setCopyState("Clipboard copy is unavailable in this browser.");
    }
  }

  async function handleCopyRiggableUrl(url: string | null) {
    if (!url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setRiggableCopyState("Asset URL copied.");
    } catch {
      setRiggableCopyState("Clipboard copy is unavailable in this browser.");
    }
  }

  function clearReferenceImage() {
    setReferenceImageFile(null);
    setReferenceImagePreviewUrl(null);
    setFileInputKey((current) => current + 1);
  }

  function handleReferenceImageChange(file: File | null) {
    if (!file) {
      return;
    }

    if (
      file.type &&
      !TRIPO_REFERENCE_IMAGE_ACCEPTED_MIME_TYPES.includes(
        file.type as (typeof TRIPO_REFERENCE_IMAGE_ACCEPTED_MIME_TYPES)[number],
      )
    ) {
      setError("Reference image must be JPEG, PNG, or WEBP.");
      return;
    }

    if (file.size > TRIPO_REFERENCE_IMAGE_MAX_BYTES) {
      setError("Reference image must be 20MB or smaller.");
      return;
    }

    setReferenceImagePreviewUrl(URL.createObjectURL(file));
    setReferenceImageFile(file);
    setError(null);
    setInfo(
      trimmedPrompt
        ? "Reference image attached. The next request will use image-to-3D with prompt guidance."
        : "Reference image attached. The next request will use image-to-3D.",
    );
  }

  function applyVoiceTranscriptToPrompt(nextTranscript: string) {
    const normalizedTranscript = nextTranscript.replace(/\s+/g, " ").trim();

    if (!normalizedTranscript) {
      return;
    }

    const previousPrompt = prompt;
    const { value, truncated } = clampPromptText(normalizedTranscript);

    setPrompt(value);
    setVoicePromptBeforeTranscript(previousPrompt);
    setVoiceFinalTranscript(value);
    setVoiceInterimTranscript("");
    setVoiceStatus(VOICE_RECEIVED_TEXT);
    setVoiceNote(
      truncated
        ? `Transcript was truncated to ${TRIPO_MAX_PROMPT_LENGTH} characters.`
        : previousPrompt.trim().length > 0
          ? "Prompt was replaced automatically. You can append the transcript instead."
          : null,
    );
  }

  function handleReplaceVoicePrompt() {
    if (!voiceFinalTranscript) {
      return;
    }

    const { value, truncated } = clampPromptText(voiceFinalTranscript);

    setPrompt(value);
    setVoiceStatus(VOICE_RECEIVED_TEXT);
    setVoiceNote(
      truncated
        ? `Transcript was truncated to ${TRIPO_MAX_PROMPT_LENGTH} characters.`
        : "Prompt replaced with the latest transcript.",
    );
  }

  function handleAppendVoicePrompt() {
    if (!voiceFinalTranscript) {
      return;
    }

    const basePrompt = voicePromptBeforeTranscript.trim();
    const combinedPrompt = basePrompt
      ? `${basePrompt}\n${voiceFinalTranscript}`
      : voiceFinalTranscript;
    const { value, truncated } = clampPromptText(combinedPrompt);

    setPrompt(value);
    setVoiceStatus(VOICE_RECEIVED_TEXT);
    setVoiceNote(
      truncated
        ? `Appended prompt was truncated to ${TRIPO_MAX_PROMPT_LENGTH} characters.`
        : "Transcript appended to the original prompt.",
    );
  }

  function handleStopVoiceInput() {
    const recognition = recognitionRef.current;

    if (!recognition) {
      setIsListening(false);
      setVoiceStatus(voiceSupportRef.current ? VOICE_READY_TEXT : VOICE_UNSUPPORTED_TEXT);
      return;
    }

    recognition.stop();
    setIsListening(false);
  }

  function handleStartVoiceInput() {
    const SpeechRecognitionConstructor = getSpeechRecognitionConstructor();

    if (!SpeechRecognitionConstructor) {
      voiceSupportRef.current = false;
      setIsVoiceSupported(false);
      setVoiceStatus(VOICE_UNSUPPORTED_TEXT);
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        cleanupRecognition();
      }

      setError(null);
      setVoiceNote(null);
      setVoiceInterimTranscript("");
      setVoiceFinalTranscript("");
      setVoicePromptBeforeTranscript("");

      const recognition = new SpeechRecognitionConstructor();

      recognition.lang = voiceLanguage;
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceStatus(VOICE_LISTENING_TEXT);
      };

      recognition.onresult = (event) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = result[0]?.transcript ?? "";

          if (result.isFinal) {
            finalTranscript += `${transcript} `;
          } else {
            interimTranscript += `${transcript} `;
          }
        }

        setVoiceInterimTranscript(interimTranscript.trim());

        if (finalTranscript.trim()) {
          applyVoiceTranscriptToPrompt(finalTranscript);
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        setVoiceInterimTranscript("");
        setVoiceStatus(
          `Voice input error: ${getVoiceInputErrorMessage(event.error)}`,
        );
      };

      recognition.onend = () => {
        cleanupRecognition();
        setIsListening(false);
        setVoiceInterimTranscript("");

        if (voiceStatusRef.current === VOICE_LISTENING_TEXT) {
          setVoiceStatus(
            voiceSupportRef.current ? VOICE_READY_TEXT : VOICE_UNSUPPORTED_TEXT,
          );
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (voiceError) {
      cleanupRecognition();
      setIsListening(false);
      setVoiceStatus(
        `Voice input error: ${
          voiceError instanceof Error
            ? voiceError.message
            : "Unable to start voice input."
        }`,
      );
    }
  }

  const refreshCacheEffect = useEffectEvent(() => {
    void refreshCache();
  });

  const refreshTaskEffect = useEffectEvent((forceRefresh = false) => {
    void refreshTask(forceRefresh);
  });

  const refreshRiggableTaskEffect = useEffectEvent((forceRefresh = false) => {
    void refreshRiggableTask(forceRefresh);
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      refreshCacheEffect();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!activeTask || !isPolling || isFinalTripoStatus(activeTask.status)) {
      return;
    }

    if (pollStartedAt && Date.now() - pollStartedAt >= POLL_TIMEOUT_MS) {
      const timeoutId = window.setTimeout(() => {
        setIsPolling(false);
        setInfo("Generation is still running. Please refresh status manually.");
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    const timeoutId = window.setTimeout(() => {
      refreshTaskEffect(true);
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeTask, isPolling, pollStartedAt]);

  useEffect(() => {
    const currentAnimationTaskId =
      riggablePipelineState.animationTaskId &&
      !isFinalTripoStatus(riggablePipelineState.animationTaskStatus ?? "queued")
        ? riggablePipelineState.animationTaskId
        : null;
    const currentRigTaskId =
      !currentAnimationTaskId &&
      riggablePipelineState.rigTaskId &&
      !isFinalTripoStatus(riggablePipelineState.rigTaskStatus ?? "queued")
        ? riggablePipelineState.rigTaskId
        : null;
    const currentGenerateTaskId =
      !currentAnimationTaskId &&
      !currentRigTaskId &&
      riggablePipelineState.generateTaskId &&
      !isFinalTripoStatus(riggablePipelineState.generateStatus ?? "queued")
        ? riggablePipelineState.generateTaskId
        : null;

    if (!isRiggablePolling || (!currentAnimationTaskId && !currentRigTaskId && !currentGenerateTaskId)) {
      return;
    }

    if (
      riggablePollStartedAt &&
      Date.now() - riggablePollStartedAt >= POLL_TIMEOUT_MS
    ) {
      const timeoutId = window.setTimeout(() => {
        setIsRiggablePolling(false);
        setRiggableInfo(
          "Riggable pipeline is still running. Please refresh status manually.",
        );
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    const timeoutId = window.setTimeout(() => {
      refreshRiggableTaskEffect(true);
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    isRiggablePolling,
    riggablePipelineState.animationTaskId,
    riggablePipelineState.animationTaskStatus,
    riggablePipelineState.generateStatus,
    riggablePipelineState.generateTaskId,
    riggablePipelineState.rigTaskId,
    riggablePipelineState.rigTaskStatus,
    riggablePollStartedAt,
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.9fr)]">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/90 p-6 shadow-[0_32px_80px_rgba(3,7,18,0.55)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.2),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.14),transparent_28%)]" />
        <div className="relative flex flex-col gap-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.28em] text-sky-100">
                <Sparkles className="h-3.5 w-3.5" />
                Dual-Track Tripo Debug
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Static props and riggable character pipelines
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                  Static ISS props stay in the normal Tripo generation flow.
                  Robots, astronauts, humanoid guides, and small creatures use
                  a separate generate → rig → animate debug pipeline. This page
                  stays isolated from the main WebXR scene and never exposes the
                  Tripo API key.
                </p>
              </div>
            </div>
            <div className="grid min-w-[220px] gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Server-side auth only
              </div>
              <div className="flex items-center gap-3">
                <Server className="h-4 w-4 text-sky-300" />
                Poll interval: 4 seconds
              </div>
              <div className="flex items-center gap-3">
                <Boxes className="h-4 w-4 text-amber-200" />
                Cache TTL: {ttlSeconds}s
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.22em] text-slate-400">
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-100">
                Part 1: Static Asset Pipeline
              </span>
              <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-sky-100">
                Part 2: Riggable Character Pipeline
              </span>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Static props should not be rigged. Rigging is only for robots,
              humanoids, guide characters, or creatures.
            </p>
          </div>

          <div className="space-y-8">
            <section className="rounded-[1.75rem] border border-white/10 bg-slate-900/60 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    Static Asset Generator
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
                    Use this for ISS modules, tools, control panels, storage
                    bags, handrails, cable bundles and docking props. These
                    assets are generated as normal GLB models and do not go
                    through rigging.
                  </p>
                </div>
                <button
                  type="button"
                  disabled
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500"
                >
                  Static props do not use rigging
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {STATIC_ASSET_PRESET_ORDER.map((presetId) => {
                  const preset = STATIC_ASSET_PRESETS[presetId];
                  const isActive = presetId === selectedPreset;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setSelectedPreset(presetId);
                        setPrompt(preset.prompt);
                        setInfo(null);
                        setError(null);
                      }}
                      className={`rounded-2xl border px-4 py-4 text-left transition duration-200 ${
                        isActive
                          ? "border-sky-400/50 bg-sky-400/12 text-white shadow-[0_12px_30px_rgba(14,165,233,0.18)]"
                          : "border-white/10 bg-white/5 text-slate-300 hover:border-sky-400/30 hover:bg-white/8"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl border border-white/10 bg-slate-900/80 p-2 text-sky-200">
                          <Boxes className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{preset.label}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {preset.prompt.slice(0, 60)}...
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(260px,0.72fr)_minmax(0,1fr)]">
                <div className="rounded-[1.5rem] border border-white/10 bg-slate-900/70 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-100">
                        Reference image
                      </div>
                      <p className="mt-1 text-xs leading-6 text-slate-400">
                        Optional. If attached, the backend uploads the image to
                        Tripo and switches generation to <code>image_to_model</code>.
                      </p>
                    </div>
                    {referenceImageFile ? (
                      <button
                        type="button"
                        onClick={clearReferenceImage}
                        className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10"
                      >
                        <X className="h-3.5 w-3.5" />
                        Clear
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-4">
                    <label className="block cursor-pointer rounded-[1.25rem] border border-dashed border-sky-400/25 bg-sky-400/6 p-4 transition hover:border-sky-300/40 hover:bg-sky-400/10">
                      <input
                        key={fileInputKey}
                        type="file"
                        accept={TRIPO_REFERENCE_IMAGE_ACCEPT}
                        className="hidden"
                        onChange={(event) => {
                          handleReferenceImageChange(event.target.files?.[0] ?? null);
                        }}
                      />
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl border border-sky-300/20 bg-sky-300/10 p-3 text-sky-100">
                          <Upload className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">
                            Upload reference image
                          </div>
                          <div className="mt-1 text-xs text-slate-300">
                            JPEG / PNG / WEBP up to 20MB
                          </div>
                        </div>
                      </div>
                    </label>

                    {referenceImagePreviewUrl ? (
                      <div className="grid gap-4 md:grid-cols-[140px_minmax(0,1fr)]">
                        <div className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-slate-950/80">
                          <Image
                            src={referenceImagePreviewUrl}
                            alt="Selected Tripo reference"
                            width={320}
                            height={320}
                            unoptimized
                            className="h-36 w-full object-cover"
                          />
                        </div>
                        <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/80 p-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-white">
                            <FileImage className="h-4 w-4 text-sky-200" />
                            {referenceImageFile?.name}
                          </div>
                          <div className="mt-3 space-y-2 text-xs text-slate-400">
                            <div>Type: {referenceImageFile?.type || "Unknown"}</div>
                            <div>
                              Size:{" "}
                              {referenceImageFile
                                ? formatFileSize(referenceImageFile.size)
                                : "Unknown"}
                            </div>
                            <div>
                              Mode after submit:{" "}
                              <span className="text-sky-100">Text + image</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                        No reference image attached. Generate with prompt only, or
                        add an image to guide the model.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-slate-900/70 p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <label
                      htmlFor="tripo-prompt"
                      className="text-sm font-medium text-slate-100"
                    >
                      Prompt guidance
                    </label>
                    <div
                      className={`rounded-full px-3 py-1 text-xs ${
                        promptLength > TRIPO_MAX_PROMPT_LENGTH
                          ? "bg-rose-500/15 text-rose-200"
                          : "bg-white/8 text-slate-300"
                      }`}
                    >
                      {promptLength}/{TRIPO_MAX_PROMPT_LENGTH}
                    </div>
                  </div>
                  <textarea
                    id="tripo-prompt"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    rows={7}
                    className="w-full resize-none rounded-[1.25rem] border border-white/10 bg-slate-950/80 px-4 py-4 text-sm leading-7 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/15"
                    placeholder="Describe the ISS prop you want to generate. Prompt is optional when a reference image is attached."
                  />

                  <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-slate-950/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">
                          Voice input
                        </div>
                        <p className="mt-1 text-xs leading-6 text-slate-400">
                          Voice input uses your browser&apos;s speech recognition.
                          Audio is not sent to our Tripo backend; only the
                          recognized text is used as the prompt.
                        </p>
                      </div>
                      <div
                        className={`rounded-full border px-3 py-1 text-xs ${getVoiceStatusClasses(
                          voiceStatusText,
                        )}`}
                      >
                        {voiceStatusText}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                        Language
                      </label>
                      <select
                        value={voiceLanguage}
                        onChange={(event) =>
                          setVoiceLanguage(event.target.value as VoiceLanguage)
                        }
                        className="rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400/40"
                      >
                        <option value="en-US">en-US</option>
                        <option value="zh-CN">zh-CN</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleStartVoiceInput}
                        disabled={!isVoiceSupported || isListening}
                        className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
                      >
                        <Mic className="h-4 w-4" />
                        Voice Input
                      </button>
                      {isListening ? (
                        <button
                          type="button"
                          onClick={handleStopVoiceInput}
                          className="inline-flex items-center gap-2 rounded-full border border-rose-400/25 bg-rose-400/10 px-4 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-400/20"
                        >
                          <Square className="h-4 w-4" />
                          Stop
                        </button>
                      ) : null}
                    </div>

                    {voiceInterimTranscript ? (
                      <div className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-400/8 p-4">
                        <div className="text-xs uppercase tracking-[0.22em] text-sky-200/80">
                          Interim transcript
                        </div>
                        <p className="mt-2 text-sm leading-7 text-sky-50">
                          {voiceInterimTranscript}
                        </p>
                      </div>
                    ) : null}

                    {voiceFinalTranscript ? (
                      <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/8 p-4">
                        <div className="text-xs uppercase tracking-[0.22em] text-emerald-100/80">
                          Latest transcript
                        </div>
                        <p className="mt-2 text-sm leading-7 text-emerald-50">
                          {voiceFinalTranscript}
                        </p>
                        {voicePromptBeforeTranscript.trim() ? (
                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={handleReplaceVoicePrompt}
                              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10"
                            >
                              Replace prompt
                            </button>
                            <button
                              type="button"
                              onClick={handleAppendVoicePrompt}
                              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10"
                            >
                              Append to prompt
                            </button>
                          </div>
                        ) : null}
                        {voiceNote ? (
                          <p className="mt-3 text-xs leading-6 text-emerald-100/80">
                            {voiceNote}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleGenerate()}
                      disabled={!canGenerateStatic}
                      className="inline-flex items-center gap-2 rounded-full bg-sky-400 px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                    >
                      {isGenerating ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Generate Static Asset
                    </button>
                    <button
                      type="button"
                      onClick={() => void refreshTask(true)}
                      disabled={!activeTask || isRefreshing}
                      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isRefreshing ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCcw className="h-4 w-4" />
                      )}
                      Manual Refresh
                    </button>
                    {isPolling ? (
                      <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs text-sky-100">
                        Auto polling every 4s
                      </span>
                    ) : null}
                  </div>

                  {staticPromptLooksRiggable ? (
                    <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                      This prompt looks like a riggable character. Use the
                      Riggable Character Generator below for robots,
                      astronauts, humanoid guides, or creatures.
                    </div>
                  ) : null}
                </div>
              </div>

              {error ? (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              ) : null}

              {info ? (
                <div className="mt-4 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4 text-sm text-sky-100">
                  {info}
                </div>
              ) : null}

              {activeTask ? (
                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.65fr)]">
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] ${getStatusClasses(
                          activeTask.status,
                        )}`}
                      >
                        {activeTask.status}
                      </span>
                      <span className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-xs uppercase tracking-[0.22em] text-slate-300">
                        {activeTask.inputMode === "image" ? "Text + image" : "Text only"}
                      </span>
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-emerald-100">
                        Static
                      </span>
                      {activeTask.mock ? (
                        <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-amber-100">
                          Mock mode
                        </span>
                      ) : null}
                      {activeTask.cached ? (
                        <span className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-xs uppercase tracking-[0.22em] text-slate-300">
                          Cached response
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                          Task ID
                        </div>
                        <div className="mt-2 break-all font-mono text-sm text-slate-100">
                          {activeTask.taskId}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                          Progress
                        </div>
                        <div className="mt-2 text-sm text-slate-100">
                          {progress ?? "Pending"} {typeof progress === "number" ? "%" : ""}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                          Generation Mode
                        </div>
                        <div className="mt-2 text-sm text-slate-100">
                          {activeTask.inputMode === "image"
                            ? "Image-guided generation"
                            : "Prompt-only generation"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                          Reference Image
                        </div>
                        <div className="mt-2 text-sm text-slate-100">
                          {activeTask.referenceImage
                            ? `${activeTask.referenceImage.name} (${formatFileSize(
                                activeTask.referenceImage.size,
                              )})`
                            : "None"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        Prompt
                      </div>
                      <p className="mt-2 text-sm leading-7 text-slate-300">
                        {activeTask.prompt || "No prompt guidance was submitted."}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-5">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                      Result
                    </div>
                    {activeTask.modelUrl ? (
                      <div className="mt-4 space-y-4">
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-4">
                          <div className="text-sm font-medium text-emerald-100">
                            Model URL ready
                          </div>
                          <div className="mt-3 break-all text-sm text-slate-200">
                            {activeTask.modelUrl}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => void handleCopyModelUrl()}
                            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10"
                          >
                            <Copy className="h-4 w-4" />
                            Copy modelUrl
                          </button>
                          <a
                            href={activeTask.modelUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-full bg-emerald-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-200"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Open in new tab
                          </a>
                        </div>
                        <p className="text-xs leading-6 text-slate-500">
                          Tripo task output URLs are temporary and may expire after a
                          few minutes.
                        </p>
                        {copyState ? (
                          <p className="text-xs text-sky-100">{copyState}</p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                        No model URL yet. Keep polling until the task reaches
                        success, or use manual refresh if the generation is still
                        running.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-[1.75rem] border border-white/10 bg-slate-900/60 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    Riggable Character Generator
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
                    Use this for assistant robots, astronauts, humanoid guides or
                    small creatures. These assets are generated first, then sent
                    through Tripo rigging and optional animation retargeting.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs leading-6 text-slate-300">
                  This is an asset pipeline debug tool. It does not implement the
                  main WebXR animation controller.
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {RIGGABLE_ASSET_PRESET_ORDER.map((presetId) => {
                  const preset = RIGGABLE_ASSET_PRESETS[presetId];
                  const isActive = presetId === selectedRiggablePreset;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyRiggablePreset(presetId)}
                      className={`rounded-2xl border px-4 py-4 text-left transition duration-200 ${
                        isActive
                          ? "border-sky-400/50 bg-sky-400/12 text-white shadow-[0_12px_30px_rgba(14,165,233,0.18)]"
                          : "border-white/10 bg-white/5 text-slate-300 hover:border-sky-400/30 hover:bg-white/8"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl border border-white/10 bg-slate-900/80 p-2 text-sky-200">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{preset.label}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {preset.prompt.slice(0, 58)}...
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
                <div className="rounded-[1.5rem] border border-white/10 bg-slate-900/70 p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <label
                      htmlFor="tripo-riggable-prompt"
                      className="text-sm font-medium text-slate-100"
                    >
                      Character prompt
                    </label>
                    <div
                      className={`rounded-full px-3 py-1 text-xs ${
                        riggablePromptLength > TRIPO_MAX_PROMPT_LENGTH
                          ? "bg-rose-500/15 text-rose-200"
                          : "bg-white/8 text-slate-300"
                      }`}
                    >
                      {riggablePromptLength}/{TRIPO_MAX_PROMPT_LENGTH}
                    </div>
                  </div>
                  <textarea
                    id="tripo-riggable-prompt"
                    value={riggablePrompt}
                    onChange={(event) => setRiggablePrompt(event.target.value)}
                    rows={7}
                    className="w-full resize-none rounded-[1.25rem] border border-white/10 bg-slate-950/80 px-4 py-4 text-sm leading-7 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/15"
                    placeholder="Describe the riggable robot, astronaut, humanoid guide, or creature you want to generate."
                  />

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/70 p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        Pipeline mode
                      </div>
                      <div className="mt-3 space-y-2">
                        {[
                          {
                            value: "static_generate",
                            label: "Generate only",
                          },
                          {
                            value: "generate_then_rig",
                            label: "Generate then Rig",
                          },
                          {
                            value: "generate_rig_then_animate",
                            label: "Generate + Rig + Animate",
                          },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                              setRiggablePipelineMode(
                                option.value as TripoPipelineMode,
                              )
                            }
                            className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                              riggablePipelineMode === option.value
                                ? "border-sky-400/40 bg-sky-400/10 text-white"
                                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/8"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/70 p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        Animation preset
                      </div>
                      <select
                        value={selectedAnimationPresetId}
                        onChange={(event) =>
                          setSelectedAnimationPresetId(
                            event.target.value as TripoAnimationPresetId,
                          )
                        }
                        className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400/40"
                      >
                        {TRIPO_ANIMATION_PRESET_ORDER.map((presetKey) => {
                          const preset = TRIPO_ANIMATION_PRESETS[presetKey];

                          return (
                            <option key={preset.id} value={preset.id}>
                              {preset.label}
                            </option>
                          );
                        })}
                      </select>
                      <p className="mt-3 text-xs leading-6 text-slate-400">
                        {selectedAnimationPreset.motionHint}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleGenerateRiggableModel()}
                      disabled={!canGenerateRiggable}
                      className="inline-flex items-center gap-2 rounded-full bg-sky-400 px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                    >
                      {isRiggableGenerating ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Generate Riggable Model
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRigGeneratedModel()}
                      disabled={
                        isRigging ||
                        !riggablePipelineState.generateTaskId ||
                        riggablePipelineState.generateStatus !== "success" ||
                        riggablePipelineMode === "static_generate"
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isRigging ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                      Rig Generated Model
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleAnimateRiggableModel()}
                      disabled={
                        isAnimating ||
                        !riggablePipelineState.rigTaskId ||
                        riggablePipelineState.rigTaskStatus !== "success"
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isAnimating ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Add Animation
                    </button>
                    <button
                      type="button"
                      onClick={() => void refreshRiggableTask(true)}
                      disabled={isRiggableRefreshing}
                      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isRiggableRefreshing ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCcw className="h-4 w-4" />
                      )}
                      Refresh Pipeline
                    </button>
                    {isRiggablePolling ? (
                      <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs text-sky-100">
                        Auto polling every 4s
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-slate-900/70 p-5">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                    Pipeline summary
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        Asset type
                      </div>
                      <div className="mt-2 text-sm text-slate-100">
                        {currentRiggablePreset.label}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        Pipeline mode
                      </div>
                      <div className="mt-2 text-sm text-slate-100">
                        {riggablePipelineMode}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        Current rig status
                      </div>
                      <div className="mt-2 text-sm text-slate-100">
                        {riggablePipelineState.rigStatus}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        Animation preset
                      </div>
                      <div className="mt-2 text-sm text-slate-100">
                        {selectedAnimationPreset.label}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        Step 1: Generate
                      </div>
                      <div className="mt-2 break-all font-mono text-sm text-slate-100">
                        {riggablePipelineState.generateTaskId ?? "Not started"}
                      </div>
                      <div className="mt-2 text-sm text-slate-300">
                        Status: {riggablePipelineState.generateStatus ?? "idle"}
                      </div>
                      {riggablePipelineState.modelUrl ? (
                        <div className="mt-3 space-y-3">
                          <div className="break-all text-xs text-slate-300">
                            {riggablePipelineState.modelUrl}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void handleCopyRiggableUrl(
                                  riggablePipelineState.modelUrl,
                                )
                              }
                              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-2 text-xs text-slate-100 transition hover:bg-white/10"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copy modelUrl
                            </button>
                            <a
                              href={riggablePipelineState.modelUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-full bg-emerald-300 px-3 py-2 text-xs font-medium text-slate-950 transition hover:bg-emerald-200"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open
                            </a>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        Step 2: Rig
                      </div>
                      <div className="mt-2 break-all font-mono text-sm text-slate-100">
                        {riggablePipelineState.rigTaskId ?? "Not started"}
                      </div>
                      <div className="mt-2 text-sm text-slate-300">
                        Status: {riggablePipelineState.rigTaskStatus ?? "idle"}
                      </div>
                      {riggablePipelineState.riggedModelUrl ? (
                        <div className="mt-3 space-y-3">
                          <div className="break-all text-xs text-slate-300">
                            {riggablePipelineState.riggedModelUrl}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void handleCopyRiggableUrl(
                                  riggablePipelineState.riggedModelUrl,
                                )
                              }
                              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-2 text-xs text-slate-100 transition hover:bg-white/10"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copy riggedModelUrl
                            </button>
                            <a
                              href={riggablePipelineState.riggedModelUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-full bg-emerald-300 px-3 py-2 text-xs font-medium text-slate-950 transition hover:bg-emerald-200"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open
                            </a>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        Step 3: Animate
                      </div>
                      <div className="mt-2 break-all font-mono text-sm text-slate-100">
                        {riggablePipelineState.animationTaskId ?? "Not started"}
                      </div>
                      <div className="mt-2 text-sm text-slate-300">
                        Status: {riggablePipelineState.animationTaskStatus ?? "idle"}
                      </div>
                      {riggablePipelineState.animatedModelUrl ? (
                        <div className="mt-3 space-y-3">
                          <div className="break-all text-xs text-slate-300">
                            {riggablePipelineState.animatedModelUrl}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void handleCopyRiggableUrl(
                                  riggablePipelineState.animatedModelUrl,
                                )
                              }
                              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-2 text-xs text-slate-100 transition hover:bg-white/10"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copy animatedModelUrl
                            </button>
                            <a
                              href={riggablePipelineState.animatedModelUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-full bg-emerald-300 px-3 py-2 text-xs font-medium text-slate-950 transition hover:bg-emerald-200"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open
                            </a>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {riggableError ? (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{riggableError}</p>
                </div>
              ) : null}

              {riggableInfo ? (
                <div className="mt-4 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4 text-sm text-sky-100">
                  {riggableInfo}
                </div>
              ) : null}

              {riggableCopyState ? (
                <p className="mt-3 text-xs text-sky-100">{riggableCopyState}</p>
              ) : null}
            </section>
          </div>
        </div>
      </section>

      <aside className="space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-slate-950/90 p-6 shadow-[0_24px_64px_rgba(3,7,18,0.45)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Recent cache</h3>
              <p className="mt-1 text-sm text-slate-400">
                Debug view of in-memory Tripo tasks for this runtime instance.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshCache()}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Refresh Cache
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {cacheEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                No cached tasks yet. Generate an asset to populate this panel.
              </div>
            ) : (
              cacheEntries.slice(0, 6).map((entry) => (
                <button
                  key={entry.taskId}
                  type="button"
                  onClick={() => {
                    if (entry.assetCategory === "riggable") {
                      const riggablePresetId = getRiggablePresetIdForAssetType(
                        entry.assetType,
                      );
                      const animationPresetId = getDefaultAnimationPresetForAsset(
                        entry.assetType ?? "assistant_robot",
                      );

                      setSelectedRiggablePreset(riggablePresetId);
                      setRiggablePrompt(
                        entry.prompt ?? RIGGABLE_ASSET_PRESETS[riggablePresetId].prompt,
                      );
                      setRiggablePipelineMode(
                        entry.pipelineMode ??
                          RIGGABLE_ASSET_PRESETS[riggablePresetId]
                            .defaultPipelineMode ??
                          "generate_then_rig",
                      );
                      setSelectedAnimationPresetId(animationPresetId);
                      setRiggablePipelineState({
                        assetType: entry.assetType ?? "assistant_robot",
                        pipelineMode: entry.pipelineMode ?? "generate_then_rig",
                        animationPresetId,
                        mock: entry.mock,
                        generateTaskId: entry.taskId,
                        generateStatus: entry.status,
                        modelUrl: entry.modelUrl,
                        rigTaskId: entry.rigTaskId ?? null,
                        rigTaskStatus: null,
                        riggedModelUrl: entry.riggedModelUrl ?? null,
                        animationTaskId: entry.animationTaskId ?? null,
                        animationTaskStatus: null,
                        animatedModelUrl: entry.animatedModelUrl ?? null,
                        rigStatus: entry.rigStatus ?? "pending",
                        raw: entry.raw,
                      });
                      setRiggablePollStartedAt(Date.now());
                      setIsRiggablePolling(
                        !isFinalTripoStatus(entry.status) ||
                          Boolean(entry.rigTaskId) ||
                          Boolean(entry.animationTaskId),
                      );
                      setRiggableInfo(
                        "Loaded a cached riggable pipeline task.",
                      );
                      setRiggableError(null);
                      return;
                    }

                    setActiveTask({
                      taskId: entry.taskId,
                      status: entry.status,
                      mock: entry.mock,
                      inputMode: getEntryInputMode(entry),
                      referenceImage: entry.referenceImage ?? null,
                      modelUrl: entry.modelUrl,
                      prompt: entry.prompt ?? getPromptFromRaw(entry.raw),
                      message: "Loaded from cache.",
                      raw: entry.raw,
                      cached: true,
                    });
                    setPollStartedAt(Date.now());
                    setIsPolling(!isFinalTripoStatus(entry.status));
                    setInfo("Loaded a cached task into the static result panel.");
                    setError(null);
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-sky-400/30 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-white">
                        {shortTaskId(entry.taskId)}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                        <span>
                          {entry.assetCategory === "riggable"
                            ? "Riggable pipeline"
                            : "Static pipeline"}
                        </span>
                        <span>•</span>
                        <span>
                          {entry.modelUrl ? "Model URL cached" : "Waiting for model URL"}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${getStatusClasses(
                        entry.status,
                      )}`}
                    >
                      {entry.status}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-slate-950/90 p-6 shadow-[0_24px_64px_rgba(3,7,18,0.45)]">
          <h3 className="text-lg font-semibold text-white">Integration note</h3>
          <p className="mt-2 text-sm leading-7 text-slate-400">
            Member B should consume <code>modelUrl</code> for static assets and
            <code>riggedModelUrl</code> / <code>animatedModelUrl</code> for
            riggable assets. This page only prepares asset URLs and debug state;
            it does not implement the main WebXR animation controller.
          </p>
        </section>
      </aside>
    </div>
  );
}
