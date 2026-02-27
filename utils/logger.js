const fs = require('fs');
const path = require('path');
const config = require('./config');

function maskPhone(p) {
  if (!p) return p;
  return p.replace(/(\+?\d{2})(\d+)(\d{2})/, (m, a, b, c) => `${a}${b.replace(/\d/g, '*')}${c}`);
}

function log(level, msg, meta) {
  const entry = { timestamp: new Date().toISOString(), level, msg, meta };
  if (meta && meta.phone) meta.phone = maskPhone(meta.phone);
  if (config.NODE_ENV === 'production') {
    const file = path.resolve(process.cwd(), 'logs', `${level}.log`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(entry) + '\n');
  } else {
    console.log(JSON.stringify(entry));
  }
}

function logInfo(msg, meta) { log('info', msg, meta); }
function logError(err, meta) { log('error', err && err.message ? err.message : String(err), meta); }
function logWarning(msg, meta) { log('warn', msg, meta); }
function logDebug(msg, meta) { if (config.NODE_ENV !== 'production') log('debug', msg, meta); }

module.exports = { logInfo, logError, logWarning, logDebug };