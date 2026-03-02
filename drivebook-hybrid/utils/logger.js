const fs = require('fs');
const path = require('path');
const config = require('./config');

function maskPhone(p) {
  if (!p) return p;
  return p.replace(/(\+?\d{2})(\d+)(\d{2})/, (m, a, b, c) => `${a}${b.replace(/\d/g, '*')}${c}`);
}

function writeLogAsync(file, line) {
  fs.mkdir(path.dirname(file), { recursive: true }, (mkdirErr) => {
    if (mkdirErr) {
      // Fallback to console if we can't write to disk
      console.error('Logger mkdir error', mkdirErr);
      return;
    }
    fs.appendFile(file, line + '\n', (appendErr) => {
      if (appendErr) {
        console.error('Logger append error', appendErr);
      }
    });
  });
}

function log(level, msg, meta) {
  const entry = { timestamp: new Date().toISOString(), level, msg, meta };
  if (meta && meta.phone) meta.phone = maskPhone(meta.phone);

  if (config.NODE_ENV === 'production') {
    const file = path.resolve(process.cwd(), 'logs', `${level}.log`);
    writeLogAsync(file, JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

function logInfo(msg, meta) { log('info', msg, meta); }
function logError(err, meta) { log('error', err && err.message ? err.message : String(err), meta); }
function logWarning(msg, meta) { log('warn', msg, meta); }
function logDebug(msg, meta) { if (config.NODE_ENV !== 'production') log('debug', msg, meta); }

module.exports = { logInfo, logError, logWarning, logDebug };