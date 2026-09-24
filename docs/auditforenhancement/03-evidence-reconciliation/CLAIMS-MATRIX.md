# CLAIMS-MATRIX — Coordinator Consolidation

**Snapshot:** main after Claude Phase 3 preservation commit `2abc29c991de7c291cbaba6175d0331d59246eff`, with model inputs including commit `e26ce1c3691c64c76262ea26732a04f65f382b42`.

**Method:** evidence over model count. This is the coordinator's reconciliation of the four model Phase 3 inputs. Kimi's repository-corroboration limits remain respected. Kiro's source verification is treated as evidence where Kiro directly inspected the repository, not as a vote.

## A. Separate security track

| ID | Conclusion | Evidence status | Disposition |
|---|---|---|---|
| S-1 | Credential-looking values are present in `docs/pr/CREDENTIAL_ROTATION_CHECKLIST.md`, marked NOT ROTATED | Documentation/source claim; liveness not established | **OPEN SECURITY TRACK. Verify through provider dashboards; rotate if live; purge history after rotation. Never authenticate with exposed values.** |
| S-2 | Shared untyped `resetToken` is used across authentication flows | Source evidence from Claude; second independent read desirable | **OPEN SECURITY FIX TRACK** |
| S-3 | OTP brute-force protections are in-memory/non-distributed and unpruned | Source evidence from Claude | **OPEN SECURITY FIX TRACK** |
| S-4/S-5/S-6 | Voice SMS relay, public bulk-booking takeover, booking-ID/access issues | Source findings from Claude, explicitly outside Copilot scope | **SEPARATE PLATFORM/VOICE SECURITY TRACK** |
| S-7 | Middleware public-path defence-in-depth issue | Single-source Claude finding | **NEEDS SECOND READ before closure** |
| S-8 | Root `.credentials` development file | Direct Kiro source evidence; distinct from S-1 | **OPEN DEV-HYGIENE FIX** |
| S-9 | `CRON_SECRET` absent from example configuration | Direct Kiro source evidence | **FIX EXAMPLE + VERIFY DEPLOYED CONFIG** |

## B. Copilot correctness

| ID | Conclusion | Evidence status | Disposition |
|---|---|---|---|
| C-1 | DB failures are converted to zero/empty across tool queries | Direct source evidence across `lib/admin/ai-tools.ts` | **VERIFIED — FIX REQUIRED, HIGH** |
| C-1a | `failedPayments` query failure can increase health score by treating failure as zero | Source mechanism verified | **VERIFIED MECHANISM — CRITICAL-CANDIDATE. Confirm intended score semantics and impact.** |
| C-2 | Instructor-risk expiry checks target fields removed from the old table instead of `DrivingProviderProfile` | Source + migration evidence | **VERIFIED — FIX REQUIRED, HIGH. Production profile coverage required before final fix design.** |
| C-3 | `expiringCount`/expiring-doc query has no-op `OR: [{}, {}]` filtering | Self-contained source logic | **VERIFIED — FIX REQUIRED, HIGH** |
| C-4 | Revenue signals span inconsistent ledgers and DIRECT payment mode may bypass wallet CREDIT | Mechanics identified; production/business semantics open | **PARTIAL — production count + financial doctrine required** |
| C-5 | Health-score edge cases make composite score potentially misleading | Source formula verified | **VERIFIED SOURCE CORRECTNESS ISSUE — FIX/REDESIGN** |
| C-6 | Suburb demand silently samples 500 records without explicit truncation/order semantics | Source evidence | **VERIFIED — FIX REQUIRED, MEDIUM** |
| C-7 | Student-retention query is duplicated | Source evidence | **VERIFIED — LOW optimisation** |

## C. AI architecture

| ID | Conclusion | Evidence status | Disposition |
|---|---|---|---|
| A-1 | No structured DriveBook knowledge layer | System prompt/source evidence | **VERIFIED ARCHITECTURE GAP — HIGH** |
| A-2 | No entity-level investigation/correlation tool | Current tools reviewed | **VERIFIED CAPABILITY GAP — sequence after contracts/knowledge** |
| A-3 | `gpt-4o-mini` is hardcoded; no benchmark/SLO | Hardcoding verified; model superiority unproven | **BENCHMARK FIRST — no model upgrade decision yet** |
| A-4 | Anthropic fallback has materially weaker tool/evidence access | Source evidence | **VERIFIED — FIX REQUIRED** |
| A-5 | No explicit FACT/INFERENCE/UNKNOWN/RECOMMENDATION discipline | Prompt absence verified | **ARCHITECTURE ENHANCEMENT** |
| A-6 | Untrusted DB content reaches model context without explicit boundary framing | Reachability verified; exploitability untested | **FIX REQUIRED + adversarial staging test** |
| A-7 | Tool/prompt/model versions are not sufficiently represented in observability | Source/architecture evidence | **ENHANCEMENT** |
| A-8 | Session conversation memory is temporary | Source evidence | **CAPABILITY GAP, not a security defect** |
| A-9 | No dedicated evaluation suite | Test search/source evidence | **FIX/ENABLER — minimum regression suite should accompany correctness/security fixes** |
| A-10 | Latency/cost/request ceilings are not defined | Architecture evidence | **DEFINE SLO before model selection** |

## D. Security/privacy governance

| ID | Conclusion | Evidence status | Disposition |
|---|---|---|---|
| P-1 | Prompt-injection reachability exists | Source verified | **FIX NOW; exploitability remains an evidence task** |
| P-2 | Copilot data scope may be broader than necessary for every role with `PLATFORM_COPILOT_VIEW` | Mapping not completed | **NEEDS RBAC/data-classification evidence** |
| P-3 | Natural-language aggregation can accelerate bulk data access/exfiltration | Reasoned threat-model item | **THREAT MODEL + budgets/monitoring; not a proven incident** |
| P-4 | AuditLog retention/access/redaction policy is not established by current evidence | Unknown | **NEEDS EVIDENCE** |
| P-5 | `__ping__` invokes the real AI path and consumes operational resources | Source flow | **LOW/MEDIUM OPS FIX** |
| P-6 | Rate-limit documentation and implementation appear inconsistent | Source mismatch reported by Kiro | **VERIFY/CORRECT DOCUMENTATION** |

## E. Positive control

**READ-ONLY BOUNDARY — VERIFIED AND PRESERVE.**

The server checks the Copilot permission before tool execution, the dispatcher is a hardcoded whitelist, and model output does not dynamically construct Prisma/raw SQL operations. No enhancement should weaken this boundary.

## F. Claims explicitly rejected or reframed

1. A newer/stronger model is required — **REJECTED AS UNPROVEN**. Benchmark first.
2. Persistent AI memory is itself a security vulnerability — **REJECTED**; capability/architecture question.
3. These are "four independent repository confirmations" — **REJECTED** because Kimi disclosed limited direct repository access.
4. Static prompt-injection reachability equals successful exploitation — **REJECTED**; staging evidence required.
5. Wallet CREDIT automatically equals accounting revenue — **REJECTED AS AN ASSUMPTION** pending financial doctrine.

## G. Implementation sequence

1. **Security:** credential verification/rotation and separate platform-security findings proceed independently.
2. **Correctness contract:** distinguish SUCCESS, EMPTY, PARTIAL and ERROR; never turn ERROR into a valid business zero.
3. **Proven defects:** fix instructor-risk schema alignment and expiring-document filtering; resolve health-score failure/edge semantics.
4. **AI safety/evaluation:** untrusted-data framing, output handling, server-side history/tool-argument validation, and blocking regression cases.
5. **Knowledge architecture:** versioned authoritative DriveBook knowledge, versioned tool schemas, provider-neutral evidence envelopes.
6. **Capability:** entity/case investigation tools only after contracts and safety boundaries are stable.
7. **Model decision:** define quality/latency/cost SLOs and benchmark candidates; do not choose a model before evidence.

## Coordinator conclusion

The four-model process has reduced the audit to a smaller set of high-confidence correctness/security issues and a separate architecture backlog. The strongest evidence comes from source-proven defects, not model agreement.

No application code is changed by this matrix. Findings enter implementation only through FINDING → VERIFIED → FIX → FIX-VERIFIED → CLOSED.


## H. Phase 4 challenge resolution — Kiro `ff6cd372`

Kiro independently challenged this consolidation. The challenge accepted the core dispositions and added specificity rather than changing the overall conclusion.

**S-7 is resolved:** Kiro's second read verified the middleware public-path defence-in-depth gap. It is now **VERIFIED, MEDIUM**, rather than awaiting another read. The current handler-level authentication checks mean the audit does not classify this as a demonstrated active takeover. Remediation should narrow the `/api/auth` public prefix or ensure protected API checks take precedence, with a regression test for overlapping paths.

**Test requirements strengthened:** blocking tests should cover C-1/C-1a failure semantics, C-2 profile/expiry states, C-3 expiry boundaries, A-6 untrusted-data injection attempts, and S-7 path overlap.

**Monitoring requirements strengthened:** surface tool/database failures and degraded provider states rather than silently absorbing them; monitor Copilot rate/resource-limit behavior.

**Coordinator resolution:** Kiro's challenge does not overturn any core disposition. It strengthens S-7 from "needs second read" to verified and adds implementation evidence requirements.
