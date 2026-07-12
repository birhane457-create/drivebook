/**
 * rebuild-vapi-assistant.js
 *
 * Deletes the existing VAPI assistant (and all its tools), then creates
 * a brand-new one with the latest prompt and tool definitions.
 *
 * Usage:
 *   node rebuild-vapi-assistant.js VAPI_API_KEY ASSISTANT_ID_TO_DELETE
 *
 * The old assistant is deleted. A new one is created and its ID is printed.
 * Update your phone number in VAPI dashboard to point to the new assistant.
 */
"use strict";

const https = require("https");
const fs = require("fs");
const path = require("path");

const apiKey = process.argv[2];
const oldAssistantId = process.argv[3];

if (!apiKey || !oldAssistantId) {
  console.error("Usage: node rebuild-vapi-assistant.js VAPI_API_KEY ASSISTANT_ID");
  process.exit(1);
}

const VAPI_WEBHOOK_SECRET = "194cad50a0fe4bd22dbfad9940abc8dea55b2058bd52c42d59cb0be9e76b560c";

const BASE_URL = "drivebook-production-12ab.up.railway.app";

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
    description: "Find and rank driving instructors for a suburb or postcode. Returns voice.summary per instructor - read it verbatim. Never say X km away.",
    method: "GET",
    url: "https://" + BASE_URL + "/api/instructors/recommendations?location={{location}}&vehicleType={{vehicleType}}",
    inputSchema: {
      type: "object",
      required: ["location"],
      properties: {
        location: { type: "string", description: "Suburb name or postcode e.g. Maylands or 6051. NOT a pickup address." },
        vehicleType: { type: "string", enum: ["AUTO", "MANUAL"], description: "Ask caller before calling." },
        language: { type: "string", description: "Optional caller language preference e.g. Arabic" },
      },
    },
  },
  {
    name: "getPackages",
    description: "Get lesson package pricing for a specific instructor. Always quote priceWithFee, never price.",
    method: "GET",
    url: "https://" + BASE_URL + "/api/packages?instructorId={{instructorId}}",
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
    url: "https://" + BASE_URL + "/api/availability/slots?instructorId={{instructorId}}&date={{date}}&lessonDurationMinutes={{lessonDurationMinutes}}",
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
    description: "Validate and geocode a pickup address. Success = response has formattedAddress. Failure = no formattedAddress or valid is false. Ask once more on failure, then accept spoken address. Never loop more than twice.",
    method: "POST",
    url: "https://" + BASE_URL + "/api/locations/validate",
    inputSchema: {
      type: "object",
      required: ["pickupLocation"],
      properties: {
        pickupLocation: { type: "string", description: "Pickup address as spoken by caller e.g. 81 King William Street Bayswater WA 6053" },
      },
    },
  },
  {
    name: "checkServiceArea",
    description: "Check if a pickup address is within the instructor service area. result=in: continue silently. result=out: tell caller and offer another instructor. result=unknown: continue silently. Never block a booking.",
    method: "GET",
    url: "https://" + BASE_URL + "/api/public/check-service-area?instructorId={{instructorId}}&address={{address}}",
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
    description: "Create a booking after verbal confirmation. Do NOT send pricing. Do NOT send isShortNotice. Read voice.confirmation from response verbatim. For Book Later set bookingType=later and omit scheduledBookings.",
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
        bookingType: { type: "string", enum: ["now", "later"] },
        registrationType: { type: "string", enum: ["myself", "someone-else"] },
        includeTestPackage: { type: "boolean", default: false },
        accountHolderName: { type: "string" },
        accountHolderEmail: { type: "string" },
        accountHolderPhone: { type: "string", description: "10-digit Australian mobile e.g. 0400123456" },
        learnerName: { type: "string" },
        learnerPhone: { type: "string" },
        learnerRelationship: { type: "string" },
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
              pickupLocation: { type: "string" },
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
    url: "https://" + BASE_URL + "/api/bookings/lookup?phone={{phone}}",
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
    description: "Check if booking can be cancelled and get exact refund amount. Always call BEFORE cancelling.",
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
    description: "Send 6-digit OTP to caller phone. Store verificationId from response internally. NEVER read it to caller.",
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
    description: "Confirm OTP. verificationId from sendOtp (stored internally). code is what caller said aloud.",
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
    description: "Cancel booking after OTP confirmed and caller said yes.",
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
    description: "Reschedule booking after OTP confirmed and new slot confirmed available.",
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
  console.log("\nDriveBook VAPI Assistant Rebuild");
  console.log("=".repeat(45));

  // Step 1: Delete old tools
  console.log("\n1. Fetching old assistant tools...");
  const existing = await vapiRequest("GET", "/assistant/" + oldAssistantId, null);
  if (existing.status !== 200) {
    console.error("Could not fetch assistant: " + existing.status);
    process.exit(1);
  }
  const oldToolIds = existing.body?.model?.toolIds || [];
  console.log("   Found " + oldToolIds.length + " old tool(s)");
  for (const id of oldToolIds) {
    const del = await vapiRequest("DELETE", "/tool/" + id, null);
    console.log("   " + (del.status === 200 || del.status === 204 ? "deleted" : "skip") + " " + id);
  }

  // Step 2: Delete old assistant
  console.log("\n2. Deleting old assistant " + oldAssistantId + "...");
  const del = await vapiRequest("DELETE", "/assistant/" + oldAssistantId, null);
  console.log("   " + (del.status === 200 || del.status === 204 ? "deleted" : "status " + del.status));

  // Step 3: Create fresh tools
  console.log("\n3. Creating " + TOOL_DEFINITIONS.length + " tools...");
  const toolIds = [];
  for (const toolDef of TOOL_DEFINITIONS) {
    const result = await vapiRequest("POST", "/tool", {
      type: "apiRequest",
      method: toolDef.method,
      url: toolDef.url,
      async: false,
      // body schema drives {{variable}} substitution in the URL for GET requests
      body: toolDef.inputSchema,
      function: {
        name: toolDef.name,
        description: toolDef.description,
        parameters: toolDef.inputSchema,
      },
    });
    if (result.status === 201 || result.status === 200) {
      console.log("   OK " + toolDef.name + " -> " + result.body.id);
      toolIds.push(result.body.id);
    } else {
      console.error("   FAIL " + toolDef.name + ": " + JSON.stringify(result.body));
    }
  }

  // Step 4: Create new assistant
  console.log("\n4. Creating new assistant...");
  const result = await vapiRequest("POST", "/assistant", {
    name: "DriveBook AI Receptionist",
    firstMessage: "Hi, thanks for calling DriveBook. I can help you book a driving lesson, reschedule, or cancel. What can I help you with today?",
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [{ role: "system", content: SYSTEM_PROMPT }],
      toolIds,
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
    silenceTimeoutSeconds: 30,
  });

  if (result.status === 200 || result.status === 201) {
    console.log("\nNew assistant created successfully");
    console.log("  ID:    " + result.body.id);
    console.log("  Tools: " + toolIds.length);
    console.log("\nNEXT STEP:");
    console.log("  Go to VAPI Dashboard -> Phone Numbers");
    console.log("  Update your AU number to use assistant: " + result.body.id);
    console.log("\n  VAPI_ASSISTANT_ID=" + result.body.id);
  } else {
    console.error("\nFailed: " + result.status);
    console.error(JSON.stringify(result.body, null, 2));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
