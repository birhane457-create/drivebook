const fetch = global.fetch || require('node-fetch');
const config = require('../utils/config');
const logger = require('../utils/logger');
const { buildSystemPrompt } = require('./system-prompt-builder');

async function connectToCopilotAgent(instructorId, callerData) {
  const timeout = config.COPILOT_TIMEOUT_MS;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const url = `${config.COPILOT_BASE_URL}/agents/${instructorId}/connect`;

  // Build grounded system prompt with live instructor context
  let systemPrompt = null;
  try {
    systemPrompt = await buildSystemPrompt(instructorId, callerData?.callerPhone || null);
  } catch (promptErr) {
    // Non-fatal — log and proceed without a custom prompt
    logger.logWarning('Failed to build system prompt, using agent defaults', {
      instructorId,
      err: promptErr.message,
    });
  }

  try {
    logger.logInfo('Connecting to Copilot agent', { instructorId, url });
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...callerData,
        // Inject the assembled system prompt — the agent should use this
        // as the base context for the conversation instead of any default prompt.
        systemPrompt: systemPrompt || undefined,
      }),
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