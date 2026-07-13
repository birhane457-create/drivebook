/**
 * Creates or updates the DriveBook AI Receptionist assistant in Vapi.
 *
 * Usage:
 *   node create-vapi-assistant.js VAPI_API_KEY
 *   node create-vapi-assistant.js VAPI_API_KEY ASSISTANT_ID   (update existing, deletes old tools first)
 */
"use strict";

const https = require("https");
const fs = require("fs");
const path = require("path");

const apiKey = process.argv[2];
const existingAssistantId = process.argv[3] || null;

if (!apiKey) {
  console.error("Usage: node create-vapi-assistant.js VAPI_API_KEY [ASSISTANT_ID]");
  process.exit(1);
}

const BASE_URL = "drivebook-production-12ab.up.railway.app";
const VAPI_WEBHOOK_SECRET = "194cad50a0fe4bd22dbfad9940abc8dea55b2058bd52c42d59cb0be9e76b560c";

function vapiRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: "api.vapi.ai",
      path: urlPath,
      method,
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
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
    if (payload) req.write(payload);
    req.end();
  });
}

const TOOL_DEFINITIONS = [
  {
    name: "findInstructors",
    description: "Find and rank driving instructors for a suburb. Returns voice.summary per instructor - read it verbatim. Never say X km away.",
    method: "GET",
    // Do NOT include query params in the URL for GET requests.
    // Vapi automatically appends schema properties as query params for GET apiRequest tools.
    url: "https://" + BASE_URL + "/api/instructors/recommendations",
    inputSchema: {
      type: "object",
      required: ["location"],
      properties: {
        location: { type: "string", description: "Suburb name or 4-digit postcode e.g. Maylands or 6051. NOT a pickup address." },
        vehicleType: { type: "string", enum: ["AUTO", "MANUAL"], description: "Ask caller before calling." },
        language: { type: "string", description: "Optional caller language preference e.g. Arabic" },
      },
    },
  },
  {
    name: "getPackages",
    description: "Get lesson package pricing for a specific instructor. Always quote priceWithFee, never price.",
    method: "GET",
    url: "https://" + BASE_URL + "/api/packages",
    inputSchema: {
      type: "object",
      required: ["instructorId"],
      properties: {
        instructorId: { type: "string", description: "From findInstructors response" },
      },
    },
  },
  {
    name: "getAvailableSlots",
    description: "Get available lesson times for a date. Use voice.confirmation from each slot to read times aloud. Store bookingTime for createBooking.",
    method: "GET",
    url: "https://" + BASE_URL + "/api/availability/slots",
    inputSchema: {
      type: "object",
      required: ["instructorId", "date"],
      properties: {
        instructorId: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        lessonDurationMinutes: { type: "integer", default: 60, description: "Always 60 unless caller requests otherwise" },
      },
    },
  },
  {
    name: "validateLocation",
    description: "Validate and geocode a pickup address. On failure ask once more then accept spoken address with pickupValidated=false. Never loop more than twice.",
    method: "POST",
    url: "https://" + BASE_URL + "/api/locations/validate",
    inputSchema: {
      type: "object",
      required: ["pickupLocation"],
      properties: {
        pickupLocation: { type: "string", description: "Pickup address as spoken by caller e.g. 81 King William Street Bayswater WA" },
      },
    },
  },
  {
    name: "checkServiceArea",
    description: "Check if a pickup address is within the instructor service area. result=in: continue silently. result=out: tell caller and offer another instructor. result=unknown: continue silently. Never block a booking.",
    method: "GET",
    url: "https://" + BASE_URL + "/api/public/check-service-area",
    inputSchema: {
      type: "object",
      required: ["instructorId", "address"],
      properties: {
        instructorId: { type: "string" },
        address: { type: "string", description: "formattedAddress from validateLocation or spoken address" },
      },
    },
  },
  {
    name: "createBooking",
    description: "Create a booking after verbal confirmation. Do NOT send pricing. Do NOT send isShortNotice - backend computes it. Read voice.confirmation from response verbatim. For Book Later set bookingType=later and omit scheduledBookings.",
    method: "POST",
    url: "https://" + BASE_URL + "/api/public/bookings/bulk",
    inputSchema: {
      type: "object",
      required: ["packageType", "hours", "bookingType", "registrationType", "includeTestPackage", "accountHolderName", "accountHolderEmail", "accountHolderPhone"],
      properties: {
        instructorId: { type: "string", description: "From findInstructors. Use instructorQuery if lost." },
        instructorQuery: { type: "string", description: "Instructor name fallback if instructorId is lost" },
        packageType: { type: "string", enum: ["PACKAGE_6", "PACKAGE_10", "PACKAGE_15"] },
        hours: { type: "string", enum: ["6", "10", "15"], description: "Must match packageType" },
        bookingType: { type: "string", enum: ["now", "later"], description: "now=schedule lesson. later=buy package only." },
        registrationType: { type: "string", enum: ["myself", "someone-else"] },
        includeTestPackage: { type: "boolean", default: false, description: "Set true only if caller explicitly asked for PDA test package" },
        accountHolderName: { type: "string" },
        accountHolderEmail: { type: "string" },
        accountHolderPhone: { type: "string", description: "10-digit Australian mobile no spaces e.g. 0400123456" },
        learnerName: { type: "string", description: "Required when registrationType is someone-else" },
        learnerPhone: { type: "string", description: "Required when registrationType is someone-else" },
        learnerRelationship: { type: "string", description: "e.g. son daughter partner - required when registrationType is someone-else" },
        scheduledBookings: {
          type: "array",
          description: "Required for bookingType=now. Omit for bookingType=later.",
          items: {
            type: "object",
            required: ["date", "time", "duration", "pickupLocation", "notes"],
            properties: {
              date: { type: "string", description: "YYYY-MM-DD" },
              time: { type: "string", description: "HH:MM 24-hour Perth time from bookingTime field in getAvailableSlots" },
              duration: { type: "integer", default: 60 },
              pickupLocation: { type: "string", description: "formattedAddress from validateLocation or spoken address if geocoding failed" },
              pickupValidated: { type: "boolean", default: true, description: "Set false when using spoken address after geocoding failed" },
              notes: { type: "string", default: "" },
            },
          },
        },
      },
    },
  },
  {
    name: "lookupBookings",
    description: "Find existing bookings by caller phone number. Use before cancel or reschedule.",
    method: "GET",
    url: "https://" + BASE_URL + "/api/bookings/lookup",
    inputSchema: {
      type: "object",
      required: ["phone"],
      properties: {
        phone: { type: "string", description: "Australian mobile e.g. 0412345678 or +61412345678" },
      },
    },
  },
  {
    name: "getCancellationPolicy",
    description: "Check if booking can be cancelled and get exact refund amount. Always call BEFORE cancelling. Never guess refund amount.",
    method: "GET",
    url: "https://" + BASE_URL + "/api/bookings/{{id}}/cancellation-policy",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Booking ID from lookupBookings" },
      },
    },
  },
  {
    name: "sendOtp",
    description: "Send 6-digit OTP to caller phone. Store verificationId from response internally. NEVER ask the caller for it.",
    method: "POST",
    url: "https://" + BASE_URL + "/api/verifications/otp",
    inputSchema: {
      type: "object",
      required: ["phone", "purpose"],
      properties: {
        phone: { type: "string" },
        purpose: { type: "string", enum: ["cancel", "reschedule"] },
      },
    },
  },
  {
    name: "confirmOtp",
    description: "Confirm OTP. verificationId is from sendOtp response stored internally. code is the 6-digit number the caller said. Never confuse these two.",
    method: "POST",
    url: "https://" + BASE_URL + "/api/verifications/otp/confirm",
    inputSchema: {
      type: "object",
      required: ["verificationId", "code", "phone"],
      properties: {
        verificationId: { type: "string", description: "From sendOtp response. Never ask caller for this." },
        code: { type: "string", description: "6-digit code the caller read aloud" },
        phone: { type: "string" },
      },
    },
  },
  {
    name: "cancelBooking",
    description: "Cancel booking after OTP confirmed and caller said yes. Never retry automatically.",
    method: "POST",
    url: "https://" + BASE_URL + "/api/public/bookings/{{id}}/cancel",
    inputSchema: {
      type: "object",
      required: ["id", "verificationToken"],
      properties: {
        id: { type: "string" },
        verificationToken: { type: "string", description: "From confirmOtp response" },
        reason: { type: "string", default: "student_request" },
      },
    },
  },
  {
    name: "rescheduleBooking",
    description: "Reschedule booking after OTP confirmed and new slot confirmed available. Never retry automatically.",
    method: "POST",
    url: "https://" + BASE_URL + "/api/public/bookings/{{id}}/reschedule",
    inputSchema: {
      type: "object",
      required: ["id", "verificationToken", "newDate", "newTime", "phone"],
      properties: {
        id: { type: "string" },
        verificationToken: { type: "string" },
        newDate: { type: "string", description: "YYYY-MM-DD" },
        newTime: { type: "string", description: "HH:MM 24-hour" },
        duration: { type: "integer", default: 60 },
        phone: { type: "string" },
        reason: { type: "string", default: "Client request" },
      },
    },
  },
];

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, "drivebook-hybrid", "VAPI_SYSTEM_PROMPT.md"),
  "utf8"
);

async function main() {
  console.log("\nDriveBook Vapi Assistant " + (existingAssistantId ? "Update" : "Create") + " Script");
  console.log("=".repeat(55));
  console.log("Target: " + BASE_URL);
  console.log("Tools:  " + TOOL_DEFINITIONS.length);
  console.log("Prompt: " + SYSTEM_PROMPT.length + " chars");
  console.log("");

  // Step 1: Delete old tools if updating existing assistant.
  // Strategy: delete ALL tools in the account that share a name with our tool definitions.
  // This catches both toolIds attached to the assistant AND orphaned tools from previous runs.
  if (existingAssistantId) {
    console.log("Cleaning up existing tools (assistant-attached + orphans)...");

    // 1a: Delete tools listed on the assistant's toolIds array
    const existing = await vapiRequest("GET", "/assistant/" + existingAssistantId, null);
    if (existing.status === 200) {
      const oldToolIds = existing.body && existing.body.model && existing.body.model.toolIds ? existing.body.model.toolIds : [];
      if (oldToolIds.length > 0) {
        console.log("  Deleting " + oldToolIds.length + " tool(s) from assistant...");
        for (const oldId of oldToolIds) {
          const del = await vapiRequest("DELETE", "/tool/" + oldId, null);
          if (del.status === 200 || del.status === 204) {
            console.log("  deleted " + oldId);
          } else {
            console.warn("  could not delete " + oldId + " (" + del.status + ")");
          }
        }
      }
    }

    // 1b: Sweep the global tool library for orphans with matching names
    const knownNames = new Set(TOOL_DEFINITIONS.map(t => t.name));
    const allTools = await vapiRequest("GET", "/tool?limit=100", null);
    if (allTools.status === 200 && Array.isArray(allTools.body)) {
      const orphans = allTools.body.filter(t => t.function && knownNames.has(t.function.name));
      if (orphans.length > 0) {
        console.log("  Found " + orphans.length + " orphan tool(s) in account — deleting...");
        for (const t of orphans) {
          const del = await vapiRequest("DELETE", "/tool/" + t.id, null);
          if (del.status === 200 || del.status === 204) {
            console.log("  deleted orphan " + t.id + " (" + t.function.name + ")");
          } else {
            console.warn("  could not delete orphan " + t.id + " (" + del.status + ")");
          }
        }
      } else {
        console.log("  No orphan tools found.");
      }
    }
    console.log("");
  }

  // Step 2: Create all tools fresh
  console.log("Creating Vapi tools...");
  const toolIds = [];

  for (const toolDef of TOOL_DEFINITIONS) {
    const payload = {
      type: "apiRequest",
      method: toolDef.method,
      url: toolDef.url,
      async: false,
      function: {
        name: toolDef.name,
        description: toolDef.description,
        parameters: toolDef.inputSchema,
      },
    };

    const result = await vapiRequest("POST", "/tool", payload);
    if (result.status === 201 || result.status === 200) {
      console.log("  OK " + toolDef.name + " -> " + result.body.id);
      toolIds.push(result.body.id);
    } else {
      console.error("  FAIL " + toolDef.name + " (" + result.status + "): " + JSON.stringify(result.body));
    }
  }

  if (toolIds.length === 0) {
    console.error("\nNo tools created. Aborting.");
    process.exit(1);
  }

  if (toolIds.length < TOOL_DEFINITIONS.length) {
    console.warn("\nWARN: Only " + toolIds.length + "/" + TOOL_DEFINITIONS.length + " tools created. Continuing anyway.");
  }

  // Step 3: Create or update assistant
  // Note: serverUrl is intentionally omitted. For apiRequest tools, Vapi calls
  // the tool URLs directly — Railway does not need to be the serverUrl.
  // Including a serverUrl causes Vapi to fire an assistant-request webhook at
  // call start; if Railway is slow to respond (~900ms), the call fails with
  // call.start.error-get-assistant before the assistant ever speaks.
  // On PATCH, Vapi preserves existing fields that are not sent — so we
  // explicitly set serverUrl and serverUrlSecret to null to clear them.
  const assistantPayload = {
    name: "DriveBook AI Receptionist",
    firstMessage: "Hi, thanks for calling DriveBook. I can help you book a driving lesson, reschedule, or cancel. What can I help you with today?",
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [{ role: "system", content: SYSTEM_PROMPT }],
      toolIds: toolIds,
    },
    voice: {
      provider: "11labs",
      voiceId: "pNInz6obpgDQGcFmaJgB",
      stability: 0.5,
      similarityBoost: 0.75,
    },
    transcriber: {
      provider: "deepgram",
      model: "nova-2",
      language: "en-AU",
    },
    endCallMessage: "Have a great day. Goodbye!",
    maxDurationSeconds: 600,
    silenceTimeoutSeconds: 55,
    serverUrl: null,
    serverUrlSecret: null,
  };

  let result;
  if (existingAssistantId) {
    console.log("\nUpdating assistant " + existingAssistantId + "...");
    result = await vapiRequest("PATCH", "/assistant/" + existingAssistantId, assistantPayload);
  } else {
    console.log("\nCreating new assistant...");
    result = await vapiRequest("POST", "/assistant", assistantPayload);
  }

  if (result.status === 200 || result.status === 201) {
    const action = existingAssistantId ? "updated" : "created";

    // Verify toolIds actually stuck (Vapi PATCH can silently ignore toolIds in some cases)
    const attached = result.body.model && result.body.model.toolIds || [];
    const missing = toolIds.filter(id => !attached.includes(id));
    if (missing.length > 0 && existingAssistantId) {
      console.warn("\nWARN: " + missing.length + " tool(s) not attached after PATCH — forcing toolIds update...");
      const fixResult = await vapiRequest("PATCH", "/assistant/" + existingAssistantId, {
        model: { provider: "openai", model: "gpt-4o-mini", toolIds: toolIds },
      });
      if (fixResult.status === 200) {
        const fixedAttached = fixResult.body.model && fixResult.body.model.toolIds || [];
        console.log("  Force-patched toolIds. Now attached:", fixedAttached.length);
      } else {
        console.error("  Force-patch failed:", JSON.stringify(fixResult.body).substring(0, 200));
      }
    }

    console.log("\nAssistant " + action + " successfully");
    console.log("   ID:    " + result.body.id);
    console.log("   Name:  " + result.body.name);
    console.log("   Tools: " + toolIds.length);
    console.log("   ToolIds attached: " + attached.length + (missing.length > 0 ? " (fixed)" : " ✓"));
    if (!existingAssistantId) {
      console.log("\nNext steps:");
      console.log("  1. Vapi Dashboard -> Phone Numbers -> select your AU number");
      console.log("  2. Set Assistant -> DriveBook AI Receptionist");
      console.log("  3. Server URL -> Secret -> paste your VAPI_WEBHOOK_SECRET");
      console.log("  4. Save");
      console.log("\n  VAPI_ASSISTANT_ID=" + result.body.id);
    }
  } else {
    console.error("\nAssistant " + (existingAssistantId ? "update" : "creation") + " failed (" + result.status + "):");
    console.error(JSON.stringify(result.body, null, 2));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nFatal error:", err.message);
  process.exit(1);
});
