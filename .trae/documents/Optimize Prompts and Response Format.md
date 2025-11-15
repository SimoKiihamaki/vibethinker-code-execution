## Goals
- Eliminate leaked meta-instructions and inner monologue in outputs
- Enforce concise, plain-English responses (no markdown, no code fences)
- Standardize JSON schemas for tool outputs (esp. dependency graph)
- Add server-side sanitization to guarantee format compliance

## Touchpoints
- System prompt and output pipeline: `mcp-server/src/orchestrator.ts`
- Dynamic per-tool prompt generator: `mcp-server/src/progressive-disclosure.ts`
- Tool-specific builders (e.g., buildGraph): `mcp-server/servers/repo-search/buildGraph.ts`

## Prompt Standards
1. In `orchestrator.ts` (system prompt at ~lines 168–199):
   - Add explicit style constraints: plain text only, no markdown/backticks, no meta commentary, no reasoning steps.
   - Cap output length (e.g., ~120–180 words for natural-language mode).
2. In `progressive-disclosure.ts` (template at ~lines 238–260):
   - Inject the same style constraints per tool.
   - Replace generic “Return results in JSON format.” with an explicit schema block per tool when JSON is required.

## Response Format Policies
- Natural language mode:
  - Sections: “Summary”, “Key Findings”, “Next Steps” (each ≤3 bullets, ≤12 words/bullet)
  - No headers markup; plain text labels only
- JSON mode:
  - Return exactly the specified schema; no preface/suffix, no code fences.

## JSON Schemas
- For dependency graph (`buildGraph`):
  ```
  {
    "summary": string,
    "metrics": { "files": number, "imports": number, "cycles": number },
    "issues": [ { "type": "cycle|missing_import|unused", "files": [string], "details": string } ],
    "entryPoints": [string],
    "hotspots": [ { "file": string, "inDegree": number, "outDegree": number } ],
    "actions": [string]
  }
  ```
- For general code-analysis tools: align to `{ summary, findings[], actions[] }` minimal schema.

## Server-Side Sanitization
- Implement `sanitizeOutput` in `orchestrator.ts` before returning results:
  - Strip backticks and fenced blocks
  - Remove lines that match meta/prompts (e.g., “Your response should be…”, “for the user”) 
  - Drop “Wait/Let me think/Hmm” style phrases
  - Enforce plain text; collapse whitespace; respect word cap
- If JSON mode: detect/parse JSON; bypass length cap; validate schema and reject extras

## Tool Builder Updates
- In `mcp-server/servers/repo-search/buildGraph.ts` (~lines 74–96):
  - Replace generic directive with explicit dependency-graph schema above
  - Add: “Return only JSON, no markdown or fences, no commentary.”
- Mirror changes across other builders to use `{ summary, findings[], actions[] }` where relevant.

## Leakage Prevention
- Ensure only assistant content is returned; never echo system/user instructions
- Trim absolute paths unless explicitly requested

## Validation
- Run `buildGraph` on a test repo; verify JSON schema, no markdown
- Run a code-analysis tool; verify concise NL mode output (plain text, capped, structured)
- Add unit tests for `sanitizeOutput` (JSON/non-JSON cases)

## Rollout
- Update `orchestrator.ts` and `progressive-disclosure.ts`
- Update `buildGraph` builder and a small set of representative builders
- Validate; then extend remaining builders in batches