/**
 * lib/uploads/validateUpload.ts
 *
 * Centralized file upload validation — MIME type allowlist + magic-byte check
 * + size limit. Call this BEFORE sending anything to Cloudinary.
 *
 * WHY TWO CHECKS:
 *   1. MIME type (file.type / Content-Type header) — can be spoofed by the client
 *   2. Magic bytes (first bytes of the actual buffer) — cannot be spoofed
 *
 * Both must pass. An SVG with an <script> tag or an .exe renamed to .jpg
 * will fail the magic-byte check even if the MIME header looks fine.
 */

// ── Allowlists ────────────────────────────────────────────────────────────────

/** Documents: images + PDF */
export const DOCUMENT_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const

/** Profile/car images: images only */
export const IMAGE_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

/** Default max size: 10MB for documents */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

/** Tighter max size for profile images */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

// ── Magic byte signatures ─────────────────────────────────────────────────────

type MagicEntry = { mime: string; bytes: (number | null)[]; offset?: number }

const MAGIC_SIGNATURES: MagicEntry[] = [
  // JPEG — FF D8 FF
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  // PNG — 89 50 4E 47 0D 0A 1A 0A
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // WebP — 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50] },
  // PDF — 25 50 44 46 (%PDF)
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
]

/**
 * Detect MIME type from buffer magic bytes.
 * Returns null if no signature matches.
 */
export function detectMimeFromBuffer(buffer: Buffer): string | null {
  for (const sig of MAGIC_SIGNATURES) {
    const offset = sig.offset ?? 0
    if (buffer.length < offset + sig.bytes.length) continue

    const match = sig.bytes.every((b, i) => b === null || buffer[offset + i] === b)
    if (match) return sig.mime
  }
  return null
}

// ── Validation result ─────────────────────────────────────────────────────────

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string; status: 400 | 413 | 415 }

// ── Main validator ────────────────────────────────────────────────────────────

/**
 * Validate a file buffer before upload.
 *
 * @param buffer       - Raw file bytes
 * @param declaredMime - MIME type from the Content-Type header / file.type (may be spoofed)
 * @param allowedTypes - Allowed MIME types for this upload context
 * @param maxBytes     - Max file size in bytes
 * @returns ValidationResult — check `.valid` before proceeding
 *
 * @example
 * const result = validateUpload(buffer, file.type, DOCUMENT_ALLOWED_TYPES, MAX_DOCUMENT_BYTES)
 * if (!result.valid) {
 *   return NextResponse.json({ error: result.error }, { status: result.status })
 * }
 */
export function validateUpload(
  buffer: Buffer,
  declaredMime: string | null | undefined,
  allowedTypes: readonly string[],
  maxBytes: number = MAX_DOCUMENT_BYTES
): ValidationResult {
  // 1. Size check
  if (buffer.length === 0) {
    return { valid: false, error: 'Empty file', status: 400 }
  }
  if (buffer.length > maxBytes) {
    const maxMB = Math.round(maxBytes / (1024 * 1024))
    return { valid: false, error: `File too large (max ${maxMB}MB)`, status: 413 }
  }

  // 2. Declared MIME check (fast, client-provided — sanity check only)
  if (declaredMime && !allowedTypes.includes(declaredMime as any)) {
    return {
      valid: false,
      error: `File type not allowed. Accepted: ${allowedTypes.join(', ')}`,
      status: 415,
    }
  }

  // 3. Magic-byte check (cannot be spoofed — reads actual file content)
  const detectedMime = detectMimeFromBuffer(buffer)
  if (!detectedMime) {
    return {
      valid: false,
      error: 'File content does not match a supported format',
      status: 415,
    }
  }
  if (!allowedTypes.includes(detectedMime as any)) {
    return {
      valid: false,
      error: `File content type not allowed. Accepted: ${allowedTypes.join(', ')}`,
      status: 415,
    }
  }

  // 4. Consistency check — declared type must match detected type
  // (catches .exe renamed to .jpg — magic bytes detect exe, not jpeg)
  if (declaredMime && declaredMime !== detectedMime) {
    return {
      valid: false,
      error: 'File content does not match declared type',
      status: 415,
    }
  }

  return { valid: true }
}

/**
 * Validate a base64 data URL (used for whiteboard canvas uploads).
 * Only PNG is accepted for canvas output.
 */
export function validateBase64DataUrl(dataUrl: string): ValidationResult {
  if (!dataUrl.startsWith('data:image/png;base64,')) {
    return { valid: false, error: 'Only PNG data URLs are accepted', status: 415 }
  }

  // Size check: base64 encodes at ~1.37x, so 3MB base64 ≈ 2.2MB actual
  if (dataUrl.length > 3 * 1024 * 1024) {
    return { valid: false, error: 'Image too large (max ~2MB)', status: 413 }
  }

  // Verify it decodes to a valid PNG by checking magic bytes
  try {
    const base64Data = dataUrl.split(',')[1]
    const buffer = Buffer.from(base64Data, 'base64')
    const detected = detectMimeFromBuffer(buffer)
    if (detected !== 'image/png') {
      return { valid: false, error: 'Data URL content is not a valid PNG', status: 415 }
    }
  } catch {
    return { valid: false, error: 'Invalid base64 data', status: 400 }
  }

  return { valid: true }
}
