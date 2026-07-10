/**
 * update-prompt-only.js
 * 
 * Patches ONLY the system prompt on an existing VAPI assistant.
 * Does NOT touch tools, voice, transcriber, or any other settings.
 * 
 * Usage:
 *   node update-prompt-only.js VAPI_API_KEY ASSISTANT_ID
 */
"use strict";

const https = require("https");
const fs = require("fs");
const path = require("path");

const apiKey = process.argv[2];
const assistantId = process.argv[3];

if (!apiKey || !assistantId) {
  console.error("Usage: node update-prompt-only.js VAPI_API_KEY ASSISTANT_ID");
  process.exit(1);
}

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, "drivebook-hybrid", "VAPI_SYSTEM_PROMPT.md"),
  "utf8"
);

function vapiPatch(assistantId, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: "api.vapi.ai",
      path: "/assistant/" + assistantId,
      method: "PATCH",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log("Patching system prompt on assistant: " + assistantId);
  console.log("Prompt length: " + SYSTEM_PROMPT.length + " chars");

  const result = await vapiPatch(assistantId, {
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [{ role: "system", content: SYSTEM_PROMPT }],
    },
  });

  if (result.status === 200) {
    console.log("Done. System prompt updated successfully.");
    console.log("  Tools:      unchanged");
    console.log("  Voice:      unchanged");
    console.log("  Transcriber: unchanged");
  } else {
    console.error("Failed (" + result.status + "):");
    console.error(JSON.stringify(result.body, null, 2));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
