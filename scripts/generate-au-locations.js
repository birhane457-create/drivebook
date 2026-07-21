'use strict';
/**
 * generate-au-locations.js
 *
 * Reads POSTCODE.CVS and generates lib/data/au-locations.ts
 * containing all Australian Delivery Area suburbs with lat/lng.
 *
 * Run: node scripts/generate-au-locations.js
 *
 * Re-run whenever POSTCODE.CVS is updated with a new Australia Post release.
 */

const fs   = require('fs');
const path = require('path');

const CSV_FILE = path.join(__dirname, '../POSTCODE.CVS');
const OUT_FILE = path.join(__dirname, '../lib/data/au-locations.ts');

// ── Parse CSV ──────────────────────────────────────────────────────────────────

function parseCSV(text) {
  const rows  = [];
  const lines = text.split('\n');
  const header = splitCSVLine(lines[0]);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = splitCSVLine(line);
    const row  = {};
    header.forEach((h, idx) => { row[h] = cols[idx] ?? ''; });
    rows.push(row);
  }
  return rows;
}

function splitCSVLine(line) {
  const cols = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

// ── Slug helpers ───────────────────────────────────────────────────────────────

function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')  // remove special chars
    .replace(/\s+/g, '-')           // spaces → hyphens
    .replace(/-+/g, '-')            // collapse multiple hyphens
    .replace(/^-|-$/g, '');         // trim leading/trailing hyphens
}

// Title-case a suburb name: "EAST PERTH" → "East Perth"
function toTitleCase(name) {
  const LOWER = new Set(['AND','OF','THE','IN','ON','AT','BY','TO','FOR','WITH','A','AN']);
  return name.split(/\s+/).map((word, idx) => {
    const clean = word.replace(/[^A-Za-z0-9'-]/g, '');
    if (idx > 0 && LOWER.has(clean.toUpperCase())) return clean.toLowerCase();
    return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  }).join(' ');
}

// ── State config ───────────────────────────────────────────────────────────────

const STATE_META = {
  WA:  { slug: 'western-australia',  displayName: 'Western Australia' },
  NSW: { slug: 'new-south-wales',    displayName: 'New South Wales' },
  VIC: { slug: 'victoria',           displayName: 'Victoria' },
  QLD: { slug: 'queensland',         displayName: 'Queensland' },
  SA:  { slug: 'south-australia',    displayName: 'South Australia' },
  TAS: { slug: 'tasmania',           displayName: 'Tasmania' },
  NT:  { slug: 'northern-territory', displayName: 'Northern Territory' },
  ACT: { slug: 'act',                displayName: 'Australian Capital Territory' },
};

// ── Main ───────────────────────────────────────────────────────────────────────

const text = fs.readFileSync(CSV_FILE, 'utf8');
const rows = parseCSV(text);

console.log(`Parsed ${rows.length} rows from CSV`);

// Filter: only Delivery Area rows with a state we care about
const filtered = rows.filter(r => {
  const type  = r.type?.trim();
  const state = r.state?.trim();
  const lat   = r.Lat_precise?.trim();
  const lng   = r.Long_precise?.trim();
  return (
    type  === 'Delivery Area' &&
    state in STATE_META &&
    lat   && lat   !== '' && lat   !== '0' && lat   !== '0.000' &&
    lng   && lng   !== '' && lng   !== '0' && lng   !== '0.000'
  );
});

console.log(`After filtering: ${filtered.length} delivery area rows with coordinates`);

// Group by state → unique suburbs (deduplicate by slug, keep most precise coords)
const byState = {};

for (const row of filtered) {
  const stateCode = row.state.trim();
  const locality  = row.locality?.trim();
  if (!locality) continue;

  const slug       = toSlug(locality);
  const postcode   = row.postcode?.trim() || '';
  const lat        = parseFloat(row.Lat_precise);
  const lng        = parseFloat(row.Long_precise);

  if (!slug || isNaN(lat) || isNaN(lng)) continue;

  if (!byState[stateCode]) byState[stateCode] = new Map();

  const existing = byState[stateCode].get(slug);
  // Keep the entry with the most complete postcode
  if (!existing || (!existing.postcode && postcode)) {
    byState[stateCode].set(slug, {
      slug,
      displayName: toTitleCase(locality),
      postcode,
      lat: parseFloat(lat.toFixed(6)),
      lng: parseFloat(lng.toFixed(6)),
    });
  }
}

// Build postcode lookup map (postcode → { suburb, state, lat, lng })
// Used by parseAuAddress for instant geocoding without external API
const postcodeLookup = {};
for (const [stateCode, suburbs] of Object.entries(byState)) {
  for (const [, sub] of suburbs) {
    if (sub.postcode && !postcodeLookup[sub.postcode]) {
      postcodeLookup[sub.postcode] = {
        suburb:  sub.displayName,
        state:   stateCode,
        lat:     sub.lat,
        lng:     sub.lng,
      };
    }
  }
}

// Count per state
for (const [code, map] of Object.entries(byState)) {
  console.log(`  ${code}: ${map.size} unique suburbs`);
}

// ── Generate TypeScript ────────────────────────────────────────────────────────

const lines = [];

lines.push(`/**`);
lines.push(` * au-locations.ts — AUTO-GENERATED`);
lines.push(` *`);
lines.push(` * Source: POSTCODE.CVS (Australia Post + ABS data)`);
lines.push(` * Generated: ${new Date().toISOString().slice(0, 10)}`);
lines.push(` * Total suburbs: ${Object.values(byState).reduce((s, m) => s + m.size, 0)}`);
lines.push(` *`);
lines.push(` * DO NOT EDIT MANUALLY. Re-run scripts/generate-au-locations.js`);
lines.push(` * to update from a new POSTCODE.CVS.`);
lines.push(` */`);
lines.push(``);
lines.push(`export interface AuSuburb {`);
lines.push(`  slug:        string;`);
lines.push(`  displayName: string;`);
lines.push(`  postcode:    string;`);
lines.push(`  lat:         number;`);
lines.push(`  lng:         number;`);
lines.push(`}`);
lines.push(``);
lines.push(`export interface AuState {`);
lines.push(`  code:        string;`);
lines.push(`  slug:        string;`);
lines.push(`  displayName: string;`);
lines.push(`  suburbs:     AuSuburb[];`);
lines.push(`}`);
lines.push(``);

// AU_STATES array
lines.push(`export const AU_STATES: AuState[] = [`);

for (const [code, meta] of Object.entries(STATE_META)) {
  const suburbs = byState[code];
  if (!suburbs || suburbs.size === 0) continue;

  lines.push(`  {`);
  lines.push(`    code: '${code}',`);
  lines.push(`    slug: '${meta.slug}',`);
  lines.push(`    displayName: '${meta.displayName}',`);
  lines.push(`    suburbs: [`);

  const sorted = [...suburbs.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  for (const s of sorted) {
    const name = s.displayName.replace(/'/g, "\\'");
    lines.push(`      { slug: '${s.slug}', displayName: '${name}', postcode: '${s.postcode}', lat: ${s.lat}, lng: ${s.lng} },`);
  }

  lines.push(`    ],`);
  lines.push(`  },`);
}

lines.push(`];`);
lines.push(``);

// POSTCODE_LOOKUP map
lines.push(`/**`);
lines.push(` * Postcode → suburb lookup.`);
lines.push(` * Use for instant address parsing without external geocoding API.`);
lines.push(` *`);
lines.push(` * Usage:`);
lines.push(` *   const info = POSTCODE_LOOKUP['6051'];`);
lines.push(` *   // → { suburb: 'Maylands', state: 'WA', lat: -31.919, lng: 115.879 }`);
lines.push(` */`);
lines.push(`export const POSTCODE_LOOKUP: Record<string, {`);
lines.push(`  suburb: string;`);
lines.push(`  state:  string;`);
lines.push(`  lat:    number;`);
lines.push(`  lng:    number;`);
lines.push(`}> = {`);

for (const [postcode, info] of Object.entries(postcodeLookup).sort()) {
  const suburb = info.suburb.replace(/'/g, "\\'");
  lines.push(`  '${postcode}': { suburb: '${suburb}', state: '${info.state}', lat: ${info.lat}, lng: ${info.lng} },`);
}

lines.push(`};`);
lines.push(``);

// Helper functions
lines.push(`// ── Helpers ────────────────────────────────────────────────────────────────────`);
lines.push(``);
lines.push(`export function getStateBySlug(slug: string): AuState | undefined {`);
lines.push(`  return AU_STATES.find(s => s.slug === slug);`);
lines.push(`}`);
lines.push(``);
lines.push(`export function getSuburbBySlug(state: AuState, suburbSlug: string): AuSuburb | undefined {`);
lines.push(`  return state.suburbs.find(s => s.slug === suburbSlug);`);
lines.push(`}`);
lines.push(``);
lines.push(`export function toSuburbSlug(name: string): string {`);
lines.push(`  return name.toLowerCase().replace(/[^a-z0-9\\s-]/g, '').replace(/\\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');`);
lines.push(`}`);
lines.push(``);
lines.push(`/**`);
lines.push(` * Parse suburb/state/postcode from a free-text Australian address.`);
lines.push(` * Uses POSTCODE_LOOKUP for instant geocoding — no external API needed.`);
lines.push(` * Falls back to regex parsing if no postcode found.`);
lines.push(` */`);
lines.push(`export function parseAuAddress(address: string | null | undefined): {`);
lines.push(`  suburb:   string | null;`);
lines.push(`  state:    string | null;`);
lines.push(`  postcode: string | null;`);
lines.push(`  lat:      number | null;`);
lines.push(`  lng:      number | null;`);
lines.push(`} {`);
lines.push(`  if (!address) return { suburb: null, state: null, postcode: null, lat: null, lng: null };`);
lines.push(``);
lines.push(`  // Try to extract postcode from the address string`);
lines.push(`  const postcodeMatch = address.match(/\\b(\\d{4})\\b/);`);
lines.push(`  if (postcodeMatch) {`);
lines.push(`    const info = POSTCODE_LOOKUP[postcodeMatch[1]];`);
lines.push(`    if (info) {`);
lines.push(`      return { suburb: info.suburb, state: info.state, postcode: postcodeMatch[1], lat: info.lat, lng: info.lng };`);
lines.push(`    }`);
lines.push(`  }`);
lines.push(``);
lines.push(`  // Fallback: regex parse "... Suburb STATE POSTCODE" pattern`);
lines.push(`  const m = address.match(/,?\\s+([A-Za-z][A-Za-z\\s'-]+?)\\s+(ACT|NSW|NT|QLD|SA|TAS|VIC|WA)\\s+(\\d{4})\\s*$/i);`);
lines.push(`  if (m) return { suburb: m[1].trim(), state: m[2].toUpperCase(), postcode: m[3], lat: null, lng: null };`);
lines.push(``);
lines.push(`  // Fallback: just state code`);
lines.push(`  const stateM = address.match(/\\b(ACT|NSW|NT|QLD|SA|TAS|VIC|WA)\\b/i);`);
lines.push(`  if (stateM) return { suburb: null, state: stateM[1].toUpperCase(), postcode: null, lat: null, lng: null };`);
lines.push(``);
lines.push(`  return { suburb: null, state: null, postcode: null, lat: null, lng: null };`);
lines.push(`}`);
lines.push(``);

// Write file
fs.writeFileSync(OUT_FILE, lines.join('\n'), 'utf8');

const stats = fs.statSync(OUT_FILE);
console.log(`\n✅ Written: lib/data/au-locations.ts`);
console.log(`   Size: ${(stats.size / 1024).toFixed(0)} KB`);
console.log(`   Postcodes in lookup: ${Object.keys(postcodeLookup).length}`);
console.log(`\nRe-run this script whenever POSTCODE.CVS is updated.`);
