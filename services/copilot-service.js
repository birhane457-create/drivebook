const fetch = global.fetch || require('node-fetch');
const config = require('../utils/config');
const logger = require('../utils/logger');

async function connectToCopilotAgent(instructorId, callerData) {
  const timeout = 5000;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const url = `${config.COPILOT_BASE_URL}/agents/${instructorId}/connect`;
  try {
    logger.logInfo('Connecting to Copilot agent', { instructorId, url });
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(callerData),
      signal: controller.signal
    });
    clearTimeout(id);
    if (!res.ok) {
      logger.logWarning('Copilot agent returned non-ok', { status: res.status });
      return null;
    }
    const json = await res.json();
    logger.logInfo('Copilot response', { instructorId, response: json });
    return json;
  } catch (err) {
    clearTimeout(id);
    logger.logError(err, { instructorId });
    return null;
  }
}

module.exports = { connectToCopilotAgent };