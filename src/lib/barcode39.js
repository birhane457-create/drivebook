// Minimal Code 39 barcode encoder — returns an array of bar widths (1 = narrow, 3 = wide),
// alternating bar/space, starting and ending with a bar.
const CODE39_PATTERNS = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
  '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
  '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
  'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
  'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
  'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
  'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
  'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
  'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
  '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
  '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100',
};

export function sanitizeForBarcode(text) {
  const upper = (text || '').toUpperCase();
  let result = '';
  for (const ch of upper) {
    if (CODE39_PATTERNS[ch]) result += ch;
  }
  return result || 'NA';
}

// Returns array of { width, isBar } segments for the full pattern (includes start/stop '*')
export function encodeCode39(value) {
  const chars = `*${sanitizeForBarcode(value)}*`.split('');
  const segments = [];
  chars.forEach((ch, idx) => {
    const pattern = CODE39_PATTERNS[ch] || CODE39_PATTERNS['*'];
    pattern.split('').forEach((bit, i) => {
      segments.push({ width: bit === '1' ? 3 : 1, isBar: i % 2 === 0 });
    });
    if (idx < chars.length - 1) {
      segments.push({ width: 1, isBar: false }); // inter-character gap
    }
  });
  return segments;
}