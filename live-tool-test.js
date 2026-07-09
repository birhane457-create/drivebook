/**
 * live-tool-test.js
 *
 * Tests every VAPI tool call against the live production API
 * exactly as VAPI would call them (GET with query params in URL).
 *
 * Usage: node live-tool-test.js
 */

const BASE = "http://localhost:3001";
const INSTRUCTOR_ID = "cmp8bq7s70001qby7fceboaoo"; // Debesay - live instructor

// VAPI sends this header on every tool call — required by verifyVapiSecret middleware
const VAPI_SECRET = process.env.VAPI_WEBHOOK_SECRET || "194cad50a0fe4bd22dbfad9940abc8dea55b2058bd52c42d59cb0be9e76b560c";

let passed = 0;
let failed = 0;

async function test(name, fn) {
  process.stdout.write(`  ${name} ... `);
  try {
    await fn();
    console.log("PASS");
    passed++;
  } catch (e) {
    console.log("FAIL: " + e.message);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function get(path) {
  const res = await fetch(BASE + path, {
    headers: { "x-vapi-secret": VAPI_SECRET },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function post(path, data) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-vapi-secret": VAPI_SECRET,
    },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function run() {
  console.log("\nDriveBook Live Tool Tests");
  console.log("=============================================");
  console.log("Target: " + BASE + "\n");

  // ── findInstructors ──────────────────────────────────────────────
  console.log("findInstructors");
  await test("200 for valid suburb", async () => {
    const { status, body } = await get("/api/instructors/recommendations?location=Maylands&vehicleType=AUTO");
    assert(status === 200, "Expected 200, got " + status + ": " + JSON.stringify(body).slice(0, 200));
    assert(Array.isArray(body.recommendations), "Missing recommendations array");
  });

  await test("400 when location missing", async () => {
    const { status } = await get("/api/instructors/recommendations?vehicleType=AUTO");
    assert(status === 400, "Expected 400, got " + status);
  });

  await test("voice.summary present on results", async () => {
    const { body } = await get("/api/instructors/recommendations?location=Maylands&vehicleType=AUTO");
    if (body.recommendations && body.recommendations.length > 0) {
      assert(typeof body.recommendations[0].voice.summary === "string", "Missing voice.summary");
      console.log("    voice.summary: " + JSON.stringify(body.recommendations[0].voice.summary));
    } else {
      console.log("    (no instructors found in Maylands - data issue, not a code bug)");
    }
  });

  // ── getPackages ──────────────────────────────────────────────────
  console.log("\ngetPackages");
  await test("200 for valid instructorId", async () => {
    const { status, body } = await get("/api/packages?instructorId=" + INSTRUCTOR_ID);
    assert(status === 200, "Expected 200, got " + status + ": " + JSON.stringify(body).slice(0, 200));
    assert(Array.isArray(body.packages), "Missing packages array");
  });

  await test("priceWithFee present (AI must quote this)", async () => {
    const { body } = await get("/api/packages?instructorId=" + INSTRUCTOR_ID);
    if (body.packages && body.packages.length > 0) {
      assert(body.packages[0].priceWithFee !== undefined, "Missing priceWithFee");
      console.log("    priceWithFee: $" + body.packages[0].priceWithFee);
    }
  });

  // ── getAvailableSlots ────────────────────────────────────────────
  console.log("\ngetAvailableSlots");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split("T")[0];

  await test("200 with availableSlots array", async () => {
    const { status, body } = await get("/api/availability/slots?instructorId=" + INSTRUCTOR_ID + "&date=" + dateStr + "&lessonDurationMinutes=60");
    assert(status === 200, "Expected 200, got " + status + ": " + JSON.stringify(body).slice(0, 200));
    assert(Array.isArray(body.availableSlots), "Missing availableSlots array");
    console.log("    slots available: " + body.availableSlots.length);
  });

  await test("timezone is Australia/Perth", async () => {
    const { body } = await get("/api/availability/slots?instructorId=" + INSTRUCTOR_ID + "&date=" + dateStr + "&lessonDurationMinutes=60");
    assert(body.timezone === "Australia/Perth", "Expected Australia/Perth, got " + body.timezone);
  });

  await test("slots have bookingTime and voice.confirmation", async () => {
    const { body } = await get("/api/availability/slots?instructorId=" + INSTRUCTOR_ID + "&date=" + dateStr + "&lessonDurationMinutes=60");
    if (body.availableSlots && body.availableSlots.length > 0) {
      const slot = body.availableSlots[0];
      assert(typeof slot.bookingTime === "string", "Missing bookingTime");
      assert(typeof slot.voice.confirmation === "string", "Missing voice.confirmation");
      console.log("    first slot: " + slot.voice.confirmation);
    } else {
      console.log("    (no slots tomorrow - check instructor working hours)");
    }
  });

  // ── validateLocation ─────────────────────────────────────────────
  console.log("\nvalidateLocation");
  await test("geocodes a valid WA address", async () => {
    const { status, body } = await post("/api/locations/validate", { pickupLocation: "81 King William Street Bayswater WA" });
    assert(status === 200, "Expected 200, got " + status + ": " + JSON.stringify(body).slice(0, 200));
    assert(body.valid === true, "Expected valid:true, got: " + JSON.stringify(body));
    assert(typeof body.formattedAddress === "string", "Missing formattedAddress");
    console.log("    formattedAddress: " + body.formattedAddress);
  });

  await test("returns invalid for nonsense address", async () => {
    const { body } = await post("/api/locations/validate", { pickupLocation: "xxxxxxxxxxx yyyyyyyyyyy" });
    assert(body.valid === false, "Expected valid:false, got: " + JSON.stringify(body));
  });

  // ── checkServiceArea ─────────────────────────────────────────────
  console.log("\ncheckServiceArea");
  await test("returns in/out/unknown for known instructor", async () => {
    const { status, body } = await get("/api/public/check-service-area?instructorId=" + INSTRUCTOR_ID + "&address=Bayswater WA 6053");
    assert(status === 200, "Expected 200, got " + status + ": " + JSON.stringify(body).slice(0, 200));
    assert(["in", "out", "unknown"].includes(body.result), "Unexpected result: " + body.result);
    console.log("    result: " + body.result + (body.distanceKm ? " (" + body.distanceKm + "km)" : ""));
  });

  // ── lookupBookings ────────────────────────────────────────────────
  console.log("\nlookupBookings");
  await test("responds to phone lookup (200 or 404)", async () => {
    const { status, body } = await get("/api/bookings/lookup?phone=0400000000");
    assert([200, 404].includes(status), "Expected 200 or 404, got " + status + ": " + JSON.stringify(body).slice(0, 200));
  });

  // ── Summary ───────────────────────────────────────────────────────
  console.log("\n=============================================");
  const total = passed + failed;
  console.log("Results: " + passed + "/" + total + " passed" + (failed > 0 ? ", " + failed + " FAILED" : " - all good"));
  if (failed > 0) process.exit(1);
}

run().catch(function(e) { console.error("Fatal:", e.message); process.exit(1); });
