export class Measures {
  constructor() {
    this.reset();
  }

  reset() {
    this.previousAction = null;
  }

  computeInstantScore(state = {}) {
    const episode = {
      taskProgress: state.taskProgress ?? 0,
      success: state.success ?? false,
      collisionCount: state.collisionCount ?? 0,
      timeCost: state.timeCost ?? 0,
      actions: state.actions ? [state.actions] : [],
    };
    return this.computeScore(episode);
  }

  computeScore(episode = {}) {
    const taskProgress = episode.taskProgress ?? 0;
    const success = Boolean(episode.success);
    const collisionCount = episode.collisionCount ?? 0;
    const timeCost = episode.timeCost ?? episode.elapsedTime ?? 0;
    const actions = episode.actions ?? episode.samples?.map((sample) => sample.action) ?? [];
    const energyCost = this.computeEnergy(actions);
    const jointLimitPenalty = this.computeJointLimitPenalty(actions);

    const breakdown = {
      progressReward: taskProgress * 10,
      successBonus: success ? 25 : 0,
      collisionPenalty: collisionCount * -5,
      timePenalty: timeCost * -0.1,
      energyPenalty: energyCost * -0.015,
      jointLimitPenalty,
    };
    const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
    return { total, breakdown };
  }

  computeEnergy(actions) {
    let total = 0;
    for (let i = 1; i < actions.length; i += 1) {
      const previous = actions[i - 1];
      const current = actions[i];
      for (const jointName of Object.keys(current)) {
        total += Math.abs((current[jointName] ?? 0) - (previous[jointName] ?? 0));
      }
    }
    return total;
  }

  computeJointLimitPenalty(actions) {
    let hits = 0;
    for (const action of actions) {
      for (const value of Object.values(action)) {
        if (Math.abs(value) >= 88 || value <= -118) hits += 1;
      }
    }
    return hits * -0.35;
  }
}
