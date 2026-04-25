export class DemoRecorder {
  constructor() {
    this.clear();
  }

  clear() {
    this.startedAt = performance.now();
    this.samples = [];
  }

  record(observation, action, info = {}) {
    this.samples.push({
      t: (performance.now() - this.startedAt) / 1000,
      observation: structuredClone(observation),
      action: structuredClone(action),
      info: structuredClone(info),
    });
  }

  exportJSON(filename = "baymax_demo_trajectory.json") {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      sampleCount: this.samples.length,
      samples: this.samples,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    console.log("Exported demo trajectory", payload);
  }

  getSamples() {
    return this.samples;
  }
}
