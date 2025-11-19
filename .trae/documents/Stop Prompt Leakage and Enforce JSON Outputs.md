## Problem
- MCP server responses are echoing prompt templates and inner reasoning instead of structured analysis.
- Tools return long meta text in `data.result` rather than strict JSON payloads.

## Root Cause
- Prompt builders instruct “Return results in JSON format” without strict enforcement, allowing models to prepend meta text.
- Parser only tries `JSON.parse` on the full string and falls back to raw text when parsing fails.
- MLX server mirror prompts likely still contain the generic directive that encourages leakage.

## Fix Strategy
### 1) Strengthen Output Parsing (MCP)
- In `mcp-server/src/orchestrator.ts`:
  - Enhance `sanitizeOutput` to remove lines starting with “Your task:”, “Output format:”, “Output example:”, and repeated sections.
  - Add `extractFirstJson(text)` to locate and parse the first valid JSON object/array within mixed text; use it before fallback to text.
  - If JSON not found and tool expects JSON, synthesize minimal JSON using the tool’s schema keys (summary/findings/actions) to prevent format breakage.

### 2) Enforce JSON-Only Prompts (MCP & MLX)
- Add explicit plain-English constraints to all prompt builders:
  - Respond in English, no markdown or code fences, no meta commentary.
  - Output ONLY a JSON object that matches the provided schema, with no surrounding text.
- Apply across remaining MCP files:
  - `mcp-server/servers/**/**/*.ts` where “Return results in JSON format.” still exists
- Mirror the same constraints and schemas to MLX:
  - `mlx-servers/servers/repo-search/*.ts`
  - `mlx-servers/servers/code-analysis/*.ts`
  - `mlx-servers/servers/context-building/*.ts`
  - `mlx-servers/servers/architectural/*.ts`

### 3) Tighten Generation Settings
- In `orchestrator.ts` execution:
  - Keep `temperature: 0.1` but reduce `max_tokens` for JSON-returning tools (e.g., 1024) to reduce verbose leakage.

### 4) Validation
- Rebuild MCP server and run representative tools:
  - `buildGraph`, `mapArchitecture`, `searchByQuery` on a local repo
- Confirm outputs are pure JSON matching schemas.
- Add quick checks in existing tests to assert no fenced blocks or meta phrases in outputs.

## Deliverables
- Parser improvements with JSON extraction and stricter sanitization in `orchestrator.ts`.
- Updated prompt builders with strict schemas across MCP and MLX servers.
- Successful build and sample tool runs with clean JSON outputs.

## Notes
- No new files added; only updates to existing files.
- Provide code references during changes for quick review.