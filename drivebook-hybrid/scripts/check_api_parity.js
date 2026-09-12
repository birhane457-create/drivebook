const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PROXY_FILE = path.join(ROOT, 'routes', 'main-app-proxy.js');
const OPENAPI_FILE = path.join(ROOT, 'openapi.yaml');

// Paths that are native to the hybrid service (not proxied to main app).
// These are documented in the spec but intentionally absent from the proxy.
const NATIVE_HYBRID_PATHS = new Set([
  '/api/voice/incoming',
  '/api/voice/voicemail',
  '/api/health',
]);

function extractProxyPaths(content) {
  const re = /router\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2/gi;
  const paths = new Set();
  let m;
  while ((m = re.exec(content)) !== null) {
    let p = m[3].trim();
    // Normalize parameter style :id -> {id}
    p = p.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
    // Ensure leading slash
    if (!p.startsWith('/')) p = '/' + p;
    // Mounted under /api in server.js
    if (!p.startsWith('/api')) p = '/api' + p;
    paths.add(p);
  }
  return Array.from(paths).sort();
}

function extractOpenApiPaths(content) {
  const lines = content.split(/\r?\n/);
  const paths = new Set();
  for (const line of lines) {
    const m = line.match(/^\s*(\/[^\s:]+)\s*:/);
    if (m) {
      let p = m[1].trim();
      // openapi basePath may be /api; normalize to include it
      if (!p.startsWith('/api')) p = '/api' + p;
      paths.add(p);
    }
  }
  return Array.from(paths).sort();
}

function main() {
  if (!fs.existsSync(PROXY_FILE)) {
    console.error('Proxy file not found:', PROXY_FILE);
    process.exit(2);
  }
  if (!fs.existsSync(OPENAPI_FILE)) {
    console.error('OpenAPI file not found:', OPENAPI_FILE);
    process.exit(2);
  }

  const proxyContent = fs.readFileSync(PROXY_FILE, 'utf8');
  const openapiContent = fs.readFileSync(OPENAPI_FILE, 'utf8');

  const proxyPaths = extractProxyPaths(proxyContent);
  const openapiPaths = extractOpenApiPaths(openapiContent);

  const proxySet = new Set(proxyPaths);
  const openapiSet = new Set(openapiPaths);

  const onlyInProxy = proxyPaths.filter(p => !openapiSet.has(p));
  // Exclude native hybrid paths from the "spec-only" list — they're intentionally not proxied
  const onlyInSpec = openapiPaths.filter(p => !proxySet.has(p) && !NATIVE_HYBRID_PATHS.has(p));

  console.log('DriveBook Hybrid API Parity Report');
  console.log('----------------------------------');
  console.log('Proxy routes found:', proxyPaths.length);
  proxyPaths.forEach(p => console.log('  ', p));
  console.log('');
  console.log('OpenAPI paths found:', openapiPaths.length);
  openapiPaths.forEach(p => {
    const note = NATIVE_HYBRID_PATHS.has(p) ? ' (native hybrid — not proxied)' : '';
    console.log('  ', p + note);
  });
  console.log('');

  if (onlyInProxy.length === 0 && onlyInSpec.length === 0) {
    console.log('✅ OK — proxy and OpenAPI are in parity.');
    process.exit(0);
  }

  if (onlyInProxy.length > 0) {
    console.log('\n⚠️ Paths implemented in proxy but missing from OpenAPI spec:');
    onlyInProxy.forEach(p => console.log('  -', p));
  }

  if (onlyInSpec.length > 0) {
    console.log('\n⚠️ Paths defined in OpenAPI spec but not proxied by hybrid:');
    onlyInSpec.forEach(p => console.log('  -', p));
  }

  console.log('\nActions:');
  console.log(' - If a path is missing in OpenAPI, update openapi.yaml or remove from code.');
  console.log(' - If a path is missing in proxy, add a proxy entry in routes/main-app-proxy.js or document its deprecation.');

  process.exit(1);
}

if (require.main === module) main();
