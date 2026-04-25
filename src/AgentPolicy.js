export class SimpleAgentPolicy {
  constructor() {
    this.startTime = performance.now();
  }

  reset() {
    this.startTime = performance.now();
  }

  act(observation) {
    const t = observation?.t ?? (performance.now() - this.startTime) / 1000;
    return {
      head_yaw: Math.sin(t * 1.1) * 35,
      head_pitch: Math.sin(t * 0.7) * 10,
      left_shoulder: -20 + Math.sin(t * 0.85) * 45,
      left_elbow: -45 + Math.sin(t * 1.35 + 0.6) * 35,
      left_hand: Math.sin(t * 1.6) * 22,
      right_shoulder: 20 + Math.sin(t * 0.9 + Math.PI) * 45,
      right_elbow: -45 + Math.sin(t * 1.25 + Math.PI) * 35,
      right_hand: Math.sin(t * 1.5 + Math.PI) * 22,
    };
  }
}

export class ParameterizedPolicy {
  constructor(theta = {}) {
    this.theta = {
      headAmp: theta.headAmp ?? 30,
      headFreq: theta.headFreq ?? 1,
      leftShoulderBase: theta.leftShoulderBase ?? -20,
      leftShoulderAmp: theta.leftShoulderAmp ?? 30,
      leftElbowBase: theta.leftElbowBase ?? -50,
      leftElbowAmp: theta.leftElbowAmp ?? 25,
      rightShoulderBase: theta.rightShoulderBase ?? 20,
      rightShoulderAmp: theta.rightShoulderAmp ?? 30,
      rightElbowBase: theta.rightElbowBase ?? -50,
      rightElbowAmp: theta.rightElbowAmp ?? 25,
    };
  }

  reset() {}

  act(observation) {
    const t = observation?.t ?? performance.now() / 1000;
    const theta = this.theta;
    const headPhase = t * theta.headFreq;
    return {
      head_yaw: Math.sin(headPhase) * theta.headAmp,
      head_pitch: Math.cos(headPhase * 0.65) * Math.min(20, theta.headAmp * 0.35),
      left_shoulder: theta.leftShoulderBase + Math.sin(t * 0.9) * theta.leftShoulderAmp,
      left_elbow: theta.leftElbowBase + Math.sin(t * 1.25 + 0.4) * theta.leftElbowAmp,
      left_hand: Math.sin(t * 1.8) * 20,
      right_shoulder: theta.rightShoulderBase + Math.sin(t * 0.9 + Math.PI) * theta.rightShoulderAmp,
      right_elbow: theta.rightElbowBase + Math.sin(t * 1.25 + Math.PI + 0.4) * theta.rightElbowAmp,
      right_hand: Math.sin(t * 1.8 + Math.PI) * 20,
    };
  }
}
