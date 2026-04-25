export type XRMode = "manual" | "replay" | "autonomous";

export type XRTaskPhase =
  | "idle"
  | "approach"
  | "stabilize"
  | "grasp"
  | "place"
  | "wipe"
  | "return_dock"
  | "success"
  | "failed";

export type XRMetricSnapshot = {
  successRate: number;
  elapsedSeconds: number;
  collisions: number;
  fuelUsed: number;
  graspStability: number;
  wipeCoverage: number;
  finalScore: number;
};

export type XREpisodeStep = {
  time: number;
  phase: XRTaskPhase;
  robotPosition: [number, number, number];
  robotRotation?: [number, number, number];
  note?: string;
};

export type XREpisode = {
  id: string;
  title: string;
  objective: string;
  steps: XREpisodeStep[];
};
