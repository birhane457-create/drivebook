'use strict';
/**
 * Shared HTTP keep-alive agents.
 * Reused across main-app-proxy and the VAPI tool-call dispatcher
 * so we don't create duplicate connection pools.
 */
const http  = require('http');
const https = require('https');

const httpAgent  = new http.Agent({ keepAlive: true, keepAliveMsecs: 30000, maxSockets: 20 });
const httpsAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 30000, maxSockets: 20 });

module.exports = { httpAgent, httpsAgent };
