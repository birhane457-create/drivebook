# Copilot Evaluation Contract

P1-10 evaluates the deterministic safety and evidence boundary around the Admin Copilot. It is an offline suite: it does not call OpenAI or Anthropic, and it does not claim that a live third-party model is immune to adversarial input.

## Authoritative Audit Context

- Accepted baseline: `373fa770983ed533d66f8ddb98cff2b8c50fd49a`.
- P1-01 through P1-09: `FIX-VERIFIED`.
- P1-08: authoritative 144-test regression baseline.
- P1-10 implementation commit: `dced35d61184f2e62af9bc9061846318f335a203`.
- P1-10 audit remediation commit: `3d747a5faed7e2de86733bcd27bdf008e795d061`.
- Scope: P1-10 evaluation contract, suite, and CI integration only.
- P1-10 status: `IMPLEMENTED / TESTED`, pending independent GPT audit.
- P1-10 is not `FIX-VERIFIED` and is not `CLOSED` until that audit is complete.
- `FIX-VERIFIED` and `CLOSED` are separate lifecycle states.

The implementation must not change application behavior outside P1-10. Pre-existing worktree changes, including booking and audit changes and `tmp_old.ts`, must remain untouched and must not be included in a P1-10 commit. A fresh agent must inspect the exact commit and current worktree before making further changes; conversational history is not an authority.

## Taxonomy

| Category | Contract | Minimum cases |
| --- | --- | ---: |
| Tool selection | Natural-language admin intent is passed through `selectCopilotTool(query)` and produces the expected read-only tool and bounded arguments. | 20 |
| Failure handling | Query failures remain explicit `ERROR` results and do not become business zeros. | 10 |
| Permission boundaries | The real `checkPermission` role/permission matrix is evaluated; route-level denial ordering remains covered by P1-08. | 10 |
| Representative scenarios | Natural-language admin workflows exercise the same deterministic selection path and verify the complete tool/argument decision. | 10 |
| Prompt injection | Hostile evidence is marked untrusted; hostile arguments and mutation tools are rejected. | 10 |

The suite contains 60 named cases plus one cross-query invariant, producing 61 test cases. A case is meaningful when it has a distinct admin intent, failure mode, authorization outcome, or hostile-data path; the count is not produced by repeating one assertion with different labels.

## Pass/fail criteria

- Every named case must pass.
- Tool names must be present in the server-owned read-only tool schema.
- Natural-language selection must return the expected tool and bounded arguments through the deterministic evaluation seam.
- Arguments must pass the server validator; invalid or unknown tools must not reach dispatch.
- Query failures must preserve `ERROR` status and an explanatory label.
- A denied Copilot request must make zero provider requests and zero tool dispatches.
- Model-facing database evidence must remain in an envelope with `untrusted: true`.

The suite verifies application-controlled evidence handling and authorization ordering. It does not test model interpretation, provider uptime, model refusal rates, or mathematical immunity to prompt injection. Those require separately governed staging or benchmark tests with pinned model versions and recorded provider evidence.

The selection seam is intentionally deterministic and offline. It is an evaluation contract for query-to-tool behavior, not a claim that a live language model uses the same heuristic implementation. Provider-model quality remains outside this suite.
