const TAU = Math.PI * 2;
const ROBOT_STEP_DEG = 5;

const ROBOTIC_GAIT_FRAMES = [
  {
    head_yaw: -10,
    head_pitch: 0,
    left_shoulder: 28,
    left_elbow: -58,
    left_hand: 0,
    right_shoulder: -28,
    right_elbow: -54,
    right_hand: 0,
    left_hip: -22,
    left_knee: 8,
    left_ankle: -8,
    right_hip: 28,
    right_knee: 48,
    right_ankle: 16,
  },
  {
    head_yaw: -10,
    head_pitch: 5,
    left_shoulder: 18,
    left_elbow: -62,
    left_hand: 5,
    right_shoulder: -18,
    right_elbow: -58,
    right_hand: -5,
    left_hip: -28,
    left_knee: 12,
    left_ankle: -12,
    right_hip: 18,
    right_knee: 60,
    right_ankle: 20,
  },
  {
    head_yaw: 0,
    head_pitch: 0,
    left_shoulder: 8,
    left_elbow: -55,
    left_hand: 0,
    right_shoulder: -8,
    right_elbow: -55,
    right_hand: 0,
    left_hip: -16,
    left_knee: 20,
    left_ankle: -4,
    right_hip: 5,
    right_knee: 30,
    right_ankle: 6,
  },
  {
    head_yaw: 10,
    head_pitch: -5,
    left_shoulder: -8,
    left_elbow: -50,
    left_hand: -5,
    right_shoulder: 8,
    right_elbow: -50,
    right_hand: 5,
    left_hip: 0,
    left_knee: 36,
    left_ankle: 8,
    right_hip: -12,
    right_knee: 8,
    right_ankle: -8,
  },
  {
    head_yaw: 10,
    head_pitch: 0,
    left_shoulder: -28,
    left_elbow: -54,
    left_hand: 0,
    right_shoulder: 28,
    right_elbow: -58,
    right_hand: 0,
    left_hip: 28,
    left_knee: 48,
    left_ankle: 16,
    right_hip: -22,
    right_knee: 8,
    right_ankle: -8,
  },
  {
    head_yaw: 10,
    head_pitch: 5,
    left_shoulder: -18,
    left_elbow: -58,
    left_hand: -5,
    right_shoulder: 18,
    right_elbow: -62,
    right_hand: 5,
    left_hip: 18,
    left_knee: 60,
    left_ankle: 20,
    right_hip: -28,
    right_knee: 12,
    right_ankle: -12,
  },
  {
    head_yaw: 0,
    head_pitch: 0,
    left_shoulder: -8,
    left_elbow: -55,
    left_hand: 0,
    right_shoulder: 8,
    right_elbow: -55,
    right_hand: 0,
    left_hip: 5,
    left_knee: 30,
    left_ankle: 6,
    right_hip: -16,
    right_knee: 20,
    right_ankle: -4,
  },
  {
    head_yaw: -10,
    head_pitch: -5,
    left_shoulder: 8,
    left_elbow: -50,
    left_hand: 5,
    right_shoulder: -8,
    right_elbow: -50,
    right_hand: -5,
    left_hip: -12,
    left_knee: 8,
    left_ankle: -8,
    right_hip: 0,
    right_knee: 36,
    right_ankle: 8,
  },
];

function quantizeAngle(value, step = ROBOT_STEP_DEG) {
  return Math.round(value / step) * step;
}

function normalizePhase(value) {
  return ((value % 1) + 1) % 1;
}

function steppedWave(t, hz, phase = 0, steps = 8) {
  const steppedPhase = Math.floor(normalizePhase(t * hz + phase) * steps) / steps;
  return Math.sin(steppedPhase * TAU);
}

function robotizeAction(action) {
  return Object.fromEntries(
    Object.entries(action).map(([jointName, value]) => [jointName, quantizeAngle(value)]),
  );
}

export class SimpleAgentPolicy {
  constructor() {
    this.startTime = performance.now() / 1000;
    this.gaitHz = 1.15;
  }

  reset() {
    this.startTime = performance.now() / 1000;
  }

  act(observation) {
    const now = observation?.t ?? performance.now() / 1000;
    const t = Math.max(0, now - this.startTime);
    const frameIndex = Math.floor(normalizePhase(t * this.gaitHz) * ROBOTIC_GAIT_FRAMES.length);
    return robotizeAction(ROBOTIC_GAIT_FRAMES[frameIndex]);
  }
}

export class ParameterizedPolicy {
  constructor(theta = {}) {
    this.theta = {
      headAmp: theta.headAmp ?? 30,
      headFreq: theta.headFreq ?? 1,
      gaitFreq: theta.gaitFreq ?? 1.1,
      leftShoulderBase: theta.leftShoulderBase ?? -20,
      leftShoulderAmp: theta.leftShoulderAmp ?? 30,
      leftElbowBase: theta.leftElbowBase ?? -50,
      leftElbowAmp: theta.leftElbowAmp ?? 25,
      rightShoulderBase: theta.rightShoulderBase ?? 20,
      rightShoulderAmp: theta.rightShoulderAmp ?? 30,
      rightElbowBase: theta.rightElbowBase ?? -50,
      rightElbowAmp: theta.rightElbowAmp ?? 25,
      hipAmp: theta.hipAmp ?? 28,
      kneeBase: theta.kneeBase ?? 24,
      kneeAmp: theta.kneeAmp ?? 26,
      ankleAmp: theta.ankleAmp ?? 14,
    };
  }

  reset() {}

  act(observation) {
    const t = observation?.t ?? performance.now() / 1000;
    const theta = this.theta;
    const headPhase = t * theta.headFreq;
    const gait = theta.gaitFreq;
    const leftStride = steppedWave(t, gait, 0);
    const rightStride = steppedWave(t, gait, 0.5);
    const leftLift = Math.max(0, steppedWave(t, gait, 0.18));
    const rightLift = Math.max(0, steppedWave(t, gait, 0.68));
    return robotizeAction({
      head_yaw: Math.sin(headPhase) * theta.headAmp,
      head_pitch: Math.cos(headPhase * 0.65) * Math.min(18, theta.headAmp * 0.3),
      left_shoulder: theta.leftShoulderBase + rightStride * theta.leftShoulderAmp,
      left_elbow: theta.leftElbowBase + Math.max(0, rightStride) * theta.leftElbowAmp,
      left_hand: steppedWave(t, gait * 1.4, 0.25) * 14,
      right_shoulder: theta.rightShoulderBase + leftStride * theta.rightShoulderAmp,
      right_elbow: theta.rightElbowBase + Math.max(0, leftStride) * theta.rightElbowAmp,
      right_hand: steppedWave(t, gait * 1.4, 0.75) * 14,
      left_hip: -leftStride * theta.hipAmp,
      left_knee: theta.kneeBase + leftLift * theta.kneeAmp,
      left_ankle: -leftStride * theta.ankleAmp,
      right_hip: -rightStride * theta.hipAmp,
      right_knee: theta.kneeBase + rightLift * theta.kneeAmp,
      right_ankle: -rightStride * theta.ankleAmp,
    });
  }
}
