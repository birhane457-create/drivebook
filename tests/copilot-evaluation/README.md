# Copilot Evaluation Contract

P1-10 evaluates the deterministic safety and evidence boundary around the Admin Copilot. It is an offline suite: it does not call OpenAI or Anthropic, and it does not claim that a live third-party model is immune to adversarial input.

## Taxonomy

| Category | Contract | Minimum cases |
| --- | --- | ---: |
| Tool selection | A representative admin intent maps to an existing read-only tool schema and valid arguments. | 20 |
| Failure handling | Query failures remain explicit `ERROR` results and do not become business zeros. | 10 |
| Permission boundaries | Permission denial happens before provider requests or tool dispatch. | 10 |
| Representative scenarios | Common admin workflows use the intended tool and bounded arguments. | 10 |
| Prompt injection | Hostile evidence is marked untrusted; hostile arguments and mutation tools are rejected. | 10 |

The suite contains 60 named cases. A case is meaningful when it has a distinct admin intent, failure mode, authorization outcome, or hostile-data path; the count is not produced by repeating one assertion with different labels.

## Pass/fail criteria

- Every named case must pass.
- Tool names must be present in the server-owned read-only tool schema.
- Arguments must pass the server validator; invalid or unknown tools must not reach dispatch.
- Query failures must preserve `ERROR` status and an explanatory label.
- A denied Copilot request must make zero provider requests and zero tool dispatches.
- Model-facing database evidence must remain in an envelope with `untrusted: true`.

The suite verifies application-controlled evidence handling and authorization ordering. It does not test model interpretation, provider uptime, model refusal rates, or mathematical immunity to prompt injection. Those require separately governed staging or benchmark tests with pinned model versions and recorded provider evidence.
