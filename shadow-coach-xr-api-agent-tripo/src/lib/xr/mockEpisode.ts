import {
  XREpisode,
  XRMetricSnapshot,
  XRTaskPhase,
} from "@/lib/xr/taskTypes";

export const MOCK_XR_EPISODE: XREpisode = {
  id: "orbital-skill-habitat-demo",
  title: "Orbital Skill Habitat Demo Episode",
  objective:
    "Approach the floating tool kit, stabilize, place it into storage, wipe the control panel, avoid the sensitive zone, and return to dock.",
  steps: [
    {
      time: 0,
      phase: "idle",
      robotPosition: [0, 1.3, 0],
      note: "Docked and waiting for the next maintenance objective.",
    },
    {
      time: 2.5,
      phase: "approach",
      robotPosition: [0.75, 1.25, -0.25],
      note: "Approaching the floating tool kit corridor lane.",
    },
    {
      time: 5,
      phase: "stabilize",
      robotPosition: [1.1, 1.15, -0.45],
      note: "Stabilizing attitude before contact in microgravity.",
    },
    {
      time: 7.5,
      phase: "grasp",
      robotPosition: [1.18, 1.1, -0.5],
      note: "Tool kit captured and aligned with storage return path.",
    },
    {
      time: 10,
      phase: "place",
      robotPosition: [1.45, 1.05, 0.85],
      note: "Placing the tool kit into the storage bag target zone.",
    },
    {
      time: 12.5,
      phase: "wipe",
      robotPosition: [-0.9, 1.18, -1.15],
      note: "Wiping the control panel surface while avoiding the red exclusion zone.",
    },
    {
      time: 15,
      phase: "return_dock",
      robotPosition: [-1.35, 1.0, 1.55],
      note: "Returning to dock after the maintenance pass.",
    },
    {
      time: 17.5,
      phase: "success",
      robotPosition: [-1.55, 0.95, 2.15],
      note: "Mission complete with safe docking and clean panel status.",
    },
  ],
};

const METRIC_BY_PHASE: Record<XRTaskPhase, XRMetricSnapshot> = {
  idle: {
    successRate: 0.38,
    elapsedSeconds: 0,
    collisions: 0,
    fuelUsed: 2.1,
    graspStability: 0.2,
    wipeCoverage: 0.02,
    finalScore: 28,
  },
  approach: {
    successRate: 0.46,
    elapsedSeconds: 2.5,
    collisions: 0,
    fuelUsed: 5.8,
    graspStability: 0.32,
    wipeCoverage: 0.02,
    finalScore: 36,
  },
  stabilize: {
    successRate: 0.55,
    elapsedSeconds: 5,
    collisions: 0,
    fuelUsed: 8.7,
    graspStability: 0.61,
    wipeCoverage: 0.02,
    finalScore: 48,
  },
  grasp: {
    successRate: 0.68,
    elapsedSeconds: 7.5,
    collisions: 0,
    fuelUsed: 11.1,
    graspStability: 0.86,
    wipeCoverage: 0.02,
    finalScore: 61,
  },
  place: {
    successRate: 0.74,
    elapsedSeconds: 10,
    collisions: 0,
    fuelUsed: 14.4,
    graspStability: 0.78,
    wipeCoverage: 0.02,
    finalScore: 71,
  },
  wipe: {
    successRate: 0.83,
    elapsedSeconds: 12.5,
    collisions: 0,
    fuelUsed: 18.9,
    graspStability: 0.78,
    wipeCoverage: 0.91,
    finalScore: 85,
  },
  return_dock: {
    successRate: 0.89,
    elapsedSeconds: 15,
    collisions: 0,
    fuelUsed: 21.4,
    graspStability: 0.78,
    wipeCoverage: 0.91,
    finalScore: 91,
  },
  success: {
    successRate: 0.94,
    elapsedSeconds: 17.5,
    collisions: 0,
    fuelUsed: 22.1,
    graspStability: 0.78,
    wipeCoverage: 0.96,
    finalScore: 96,
  },
  failed: {
    successRate: 0.12,
    elapsedSeconds: 17.5,
    collisions: 2,
    fuelUsed: 25,
    graspStability: 0.2,
    wipeCoverage: 0.2,
    finalScore: 18,
  },
};

export function getMetricsForPhase(phase: XRTaskPhase) {
  return METRIC_BY_PHASE[phase];
}
