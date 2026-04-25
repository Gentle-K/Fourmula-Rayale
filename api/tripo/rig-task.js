const { getRigTask, json } = require("../../server/tripo-common.cjs");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  const taskId = String(req.query?.taskId ?? "").trim();
  if (!taskId) return json(res, 400, { ok: false, error: "taskId is required." });

  try {
    return json(res, 200, await getRigTask(taskId));
  } catch (error) {
    return json(res, 500, { ok: false, error: error instanceof Error ? error.message : "Failed to poll rig task." });
  }
};
