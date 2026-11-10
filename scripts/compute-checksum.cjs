const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const f = path.join(__dirname, '..', 'prisma', 'migrations',
  '20261109000001_add_provider_industry_and_discovery', 'migration.sql');
const content = fs.readFileSync(f);
const hash = crypto.createHash('sha256').update(content).digest('hex');
console.log('File:', f);
console.log('Size:', content.length, 'bytes');
console.log('SHA-256:', hash);
// Also show first/last few bytes to confirm content
console.log('Content preview (first 200 chars):\n', content.toString('utf8').substring(0, 200));
