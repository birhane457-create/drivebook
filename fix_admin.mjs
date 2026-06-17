import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';

const subs = [
  [/\bbg-white\b/g, 'bg-slate-900'],
  [/\bbg-gray-50\b/g, 'bg-slate-950'],
  [/\bbg-gray-100\b/g, 'bg-slate-900'],
  [/\bbg-gray-200\b/g, 'bg-slate-800'],
  [/\btext-gray-900\b/g, 'text-slate-100'],
  [/\btext-gray-800\b/g, 'text-slate-200'],
  [/\btext-gray-700\b/g, 'text-slate-300'],
  [/\btext-gray-600\b/g, 'text-slate-400'],
  [/\btext-gray-500\b/g, 'text-slate-400'],
  [/\btext-gray-400\b/g, 'text-slate-500'],
  [/\btext-gray-300\b/g, 'text-slate-500'],
  [/\bborder-gray-50\b/g, 'border-slate-800'],
  [/\bborder-gray-100\b/g, 'border-slate-800'],
  [/\bborder-gray-200\b/g, 'border-slate-700'],
  [/\bborder-gray-300\b/g, 'border-slate-700'],
  [/\bdivide-gray-100\b/g, 'divide-slate-800'],
  [/\bdivide-gray-200\b/g, 'divide-slate-700'],
  [/\bhover:bg-gray-50\b/g, 'hover:bg-slate-800/50'],
  [/\bhover:bg-gray-100\b/g, 'hover:bg-slate-800'],
  [/\bhover:text-gray-900\b/g, 'hover:text-slate-100'],
  [/\bhover:text-gray-700\b/g, 'hover:text-slate-300'],
  [/bg-green-100 text-green-[78]00/g, 'bg-green-900/40 text-green-300'],
  [/bg-red-100 text-red-[78]00/g, 'bg-red-900/40 text-red-300'],
  [/bg-yellow-100 text-yellow-[78]00/g, 'bg-yellow-900/40 text-yellow-300'],
  [/bg-blue-100 text-blue-[78]00/g, 'bg-blue-900/40 text-blue-300'],
  [/bg-purple-100 text-purple-[78]00/g, 'bg-violet-900/40 text-violet-300'],
  [/\bbg-green-100\b/g, 'bg-green-900/40'],
  [/\bbg-red-100\b/g, 'bg-red-900/40'],
  [/\bbg-blue-100\b/g, 'bg-blue-900/40'],
  [/\bbg-purple-100\b/g, 'bg-violet-900/40'],
  [/\bbg-blue-50\b/g, 'bg-blue-900/20'],
  [/\bbg-red-50\b/g, 'bg-red-900/20'],
  [/\bbg-green-50\b/g, 'bg-green-900/20'],
  [/\bbg-amber-50\b/g, 'bg-amber-900/20'],
  [/\bbg-yellow-50\b/g, 'bg-yellow-900/20'],
  [/\bbg-purple-50\b/g, 'bg-violet-900/20'],
  [/\bborder-blue-200\b/g, 'border-blue-700/50'],
  [/\bborder-red-200\b/g, 'border-red-700/50'],
  [/\bborder-green-200\b/g, 'border-green-700/50'],
  [/\btext-blue-800\b/g, 'text-blue-300'],
  [/\btext-blue-900\b/g, 'text-blue-200'],
  [/\btext-red-800\b/g, 'text-red-300'],
  [/\btext-green-800\b/g, 'text-green-300'],
  [/\btext-amber-800\b/g, 'text-amber-300'],
  [/\btext-purple-800\b/g, 'text-violet-300'],
  [/bg-gray-600 bg-opacity-50/g, 'bg-slate-950/80'],
  [/bg-black bg-opacity-50/g, 'bg-slate-950/80'],
  [/bg-gray-200 rounded-full/g, 'bg-slate-700 rounded-full'],
];

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else if (entry.name.endsWith('.tsx')) results.push(full);
  }
  return results;
}

const files = [...walk(join('app', 'admin')), ...walk(join('components', 'admin'))];
let updated = 0;
for (const f of files) {
  let c = readFileSync(f, 'utf8');
  const orig = c;
  for (const [pattern, replacement] of subs) {
    c = c.replace(pattern, replacement);
  }
  if (c !== orig) {
    writeFileSync(f, c);
    updated++;
    console.log('Updated: ' + relative('.', f));
  }
}
console.log('\nDone — ' + updated + '/' + files.length + ' files updated');
