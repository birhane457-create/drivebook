export type UntrustedEvidenceEnvelope = {
  source: 'admin-copilot-tool'
  tool: string
  untrusted: true
  data: unknown
}

export function createUntrustedEvidenceEnvelope(
  tool: string,
  data: unknown,
): UntrustedEvidenceEnvelope {
  return {
    source: 'admin-copilot-tool',
    tool,
    untrusted: true,
    data,
  }
}
