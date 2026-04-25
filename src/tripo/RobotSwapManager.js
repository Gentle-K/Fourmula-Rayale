export class RobotSwapManager {
  constructor({ onSwapRobot, onPauseAgent = () => {}, onResumeAgent = () => {} } = {}) {
    this.onSwapRobot = onSwapRobot;
    this.onPauseAgent = onPauseAgent;
    this.onResumeAgent = onResumeAgent;
  }

  async replaceCurrentRobot({ robotRoot, boneMap, validation, assetRecord }) {
    if (!robotRoot) throw new Error("Robot swap requires a loaded robot root.");
    if (!boneMap || Object.keys(boneMap).length === 0) throw new Error("Robot swap requires a bone map.");
    if (!validation?.ok) throw new Error(validation?.reason || "Rig validation failed.");
    if (!this.onSwapRobot) throw new Error("RobotSwapManager has no onSwapRobot handler.");

    this.onPauseAgent();
    try {
      const result = await this.onSwapRobot({ robotRoot, boneMap, validation, assetRecord });
      this.onResumeAgent();
      return result;
    } catch (error) {
      this.onResumeAgent();
      throw error;
    }
  }
}
