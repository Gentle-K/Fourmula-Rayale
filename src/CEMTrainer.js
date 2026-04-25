import { ParameterizedPolicy } from "./AgentPolicy.js";

const PARAM_KEYS = [
  "headAmp",
  "headFreq",
  "leftShoulderBase",
  "leftShoulderAmp",
  "leftElbowBase",
  "leftElbowAmp",
  "rightShoulderBase",
  "rightShoulderAmp",
  "rightElbowBase",
  "rightElbowAmp",
];

const DEFAULT_MEAN = {
  headAmp: 28,
  headFreq: 1,
  leftShoulderBase: -20,
  leftShoulderAmp: 35,
  leftElbowBase: -50,
  leftElbowAmp: 30,
  rightShoulderBase: 20,
  rightShoulderAmp: 35,
  rightElbowBase: -50,
  rightElbowAmp: 30,
};

const DEFAULT_STD = {
  headAmp: 12,
  headFreq: 0.35,
  leftShoulderBase: 20,
  leftShoulderAmp: 18,
  leftElbowBase: 20,
  leftElbowAmp: 18,
  rightShoulderBase: 20,
  rightShoulderAmp: 18,
  rightElbowBase: 20,
  rightElbowAmp: 18,
};

function gaussian() {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function average(items, key) {
  return items.reduce((sum, item) => sum + item.theta[key], 0) / Math.max(1, items.length);
}

export class CEMTrainer {
  constructor(robotController, measures, options = {}) {
    this.robotController = robotController;
    this.measures = measures;
    this.options = {
      populationSize: options.populationSize ?? 12,
      eliteRatio: options.eliteRatio ?? 0.25,
      iterations: options.iterations ?? 10,
      episodeDuration: options.episodeDuration ?? 5,
      stepsPerEpisode: options.stepsPerEpisode ?? 80,
    };
    this.mean = { ...DEFAULT_MEAN, ...(options.mean ?? {}) };
    this.std = { ...DEFAULT_STD, ...(options.std ?? {}) };
    this.iteration = 0;
    this.learningCurve = [];
  }

  sampleTheta() {
    const theta = {};
    for (const key of PARAM_KEYS) {
      theta[key] = this.mean[key] + gaussian() * this.std[key];
    }
    theta.headFreq = Math.max(0.1, theta.headFreq);
    return theta;
  }

  evaluateTheta(theta) {
    const policy = new ParameterizedPolicy(theta);
    const actions = [];
    let smoothness = 0;
    let reachScore = 0;
    let previous = null;

    for (let i = 0; i < this.options.stepsPerEpisode; i += 1) {
      const observation = { t: (i / this.options.stepsPerEpisode) * this.options.episodeDuration };
      const action = policy.act(observation);
      actions.push(action);

      if (previous) {
        for (const jointName of Object.keys(action)) {
          smoothness += Math.abs(action[jointName] - previous[jointName]);
        }
      }
      previous = action;

      reachScore +=
        Math.abs(action.left_shoulder - action.right_shoulder) * 0.005 +
        Math.abs(action.left_elbow + action.right_elbow) * 0.003;
    }

    const score = this.measures.computeScore({
      taskProgress: Math.min(1, reachScore / this.options.stepsPerEpisode),
      success: reachScore / this.options.stepsPerEpisode > 0.3,
      timeCost: this.options.episodeDuration,
      actions,
    });

    return {
      theta,
      score: score.total - smoothness * 0.001,
      breakdown: score.breakdown,
    };
  }

  step() {
    const population = [];
    for (let i = 0; i < this.options.populationSize; i += 1) {
      population.push(this.evaluateTheta(this.sampleTheta()));
    }

    population.sort((a, b) => b.score - a.score);
    const eliteCount = Math.max(1, Math.floor(this.options.populationSize * this.options.eliteRatio));
    const elites = population.slice(0, eliteCount);
    this.updateDistribution(elites);
    this.iteration += 1;

    const best = population[0];
    const eliteAvg = elites.reduce((sum, result) => sum + result.score, 0) / elites.length;
    const point = {
      iteration: this.iteration,
      best: best.score,
      eliteAvg,
      theta: best.theta,
    };
    this.learningCurve.push(point);
    console.log("CEM learning curve:", point);

    if (this.robotController) this.robotController.applyAction(new ParameterizedPolicy(best.theta).act({ t: performance.now() / 1000 }));
    return point;
  }

  updateDistribution(elites) {
    for (const key of PARAM_KEYS) {
      const mean = average(elites, key);
      const variance =
        elites.reduce((sum, item) => sum + (item.theta[key] - mean) ** 2, 0) / Math.max(1, elites.length);
      this.mean[key] = mean;
      this.std[key] = Math.max(0.01, Math.sqrt(variance) * 0.85);
    }
  }

  getLearningCurve() {
    return this.learningCurve;
  }
}
