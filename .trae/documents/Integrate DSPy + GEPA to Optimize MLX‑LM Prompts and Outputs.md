## Why DSPy + GEPA
- GEPA evolves prompt text using reflective feedback, improving program quality with few rollouts [1][3][4].
- Works without large labeled datasets by leveraging textual feedback in metrics; ideal for our JSON-structured tools [1][5].
- Can be run offline to produce improved prompts, or online as a batch inference-time search to pick best outputs per task [1].

## Current State (Targets)
- MLX invocation client centralizes completions and chat calls with instance health and metrics: `mcp-server/src/client.ts:110` (generateCompletion) and `mcp-server/src/client.ts:165` (generateChatCompletion).
- Prompt builders follow a consistent build/parse pattern across tools. Example:
  - `mcp-server/servers/code-analysis/analyzeFile.ts:77` builds a static instruction block; `:110` parses JSON or falls back to structured text.
- Other high-impact prompts follow the same pattern (same call site at `:45` for execute):
  - `servers/code-analysis/{detectIssues.ts, findPatterns.ts, analyzeFunction.ts}`
  - `servers/context-building/{summarizeModule.ts, gatherContext.ts, buildDocumentation.ts}`
  - `servers/architectural/{identifyPatterns.ts, synthesizeFindings.ts}`
  - `servers/repo-search/{findDependencies.ts, analyzeImports.ts, buildGraph.ts, searchByQuery.ts}`

## Integration Architecture
- **Offline Prompt Optimization (recommended first):**
  - Build a small Python optimization harness using DSPy.
  - Implement a custom `dspy.LM` adapter that calls our MLX server (`/v1/completions`) to keep the student LM consistent with production.
  - Use GEPA with a stronger reflection LM (e.g., OpenRouter or Azure OpenAI) to propose improved instructions; export optimized prompt text.
  - Update the TypeScript prompt builders in-place, preserving their structure, replacing only the instruction blocks and optional few-shot demos.
- **Inference-Time Batch Search (optional later):**
  - For batch workflows (e.g., repo search across many files), call GEPA with `valset=trainset`, `track_stats=true`, `track_best_outputs=true` and pick the Pareto frontier best outputs per task [1].
  - Expose a lightweight Python microservice endpoint for batch optimization results used by `mcp-server/src/orchestrator.ts:86`.

## DSPy Program Design
- **Signatures:** Mirror each tool’s IO schema (e.g., `analyzeFile` expects JSON with `summary`, `metrics`, `findings`, `actions`).
- **Modules:** One module per tool, e.g., `AnalyzeFileModule(Signature)`.
- **Metric (GEPAFeedbackMetric):**
  - Structure adherence: JSON parse success + required fields present; return score + textual feedback describing missing fields/format errors.
  - Task-specific checks: e.g., for `detectIssues`, ensure findings have `type`, `file`, `line`; provide feedback when hallucinated file paths are detected.
  - Add `add_format_failure_as_feedback=true` so GEPA uses formatting errors as feedback [1].
- **LM backends:**
  - Student LM: MLX via custom `dspy.LM` adapter hitting our `/v1/completions`.
  - Reflection LM: a stronger remote model per GEPA guidance (preset `auto='light'` for a small budget) [1][5].

## Data and Feedback
- **Trainset:**
  - Start with 20–50 synthetic inputs per tool built from repository snippets and known edge cases (e.g., large files, mixed imports, unusual architectures).
- **Valset:**
  - Hold-out 20% for validation. For batch settings, reuse the trainset as valset to compute a Pareto frontier [1].
- **Feedback Sources:**
  - JSON format failures, heuristic validators, optional LLM-as-judge to grade clarity/consistency for summaries [4][5].

## Pilot Scope (2–3 tools)
- `analyzeFile`: clear schema, format-sensitive.
- `detectIssues`: rich findings structure; good for error-driven feedback.
- `summarizeModule`: human-readability metric + structure checks.

## Implementation Steps
1. Build Python optimization harness
- Install `dspy` and `gepa`; configure student LM via MLX HTTP; configure reflection LM via OpenRouter.
- Define Signatures/Modules for 3 pilot tools; write GEPA feedback metrics producing scores and targeted text feedback.
- Run `dspy.GEPA(auto='light', track_stats=True)` to evolve instructions; capture optimized prompts.
2. Evaluate and select prompts
- Measure JSON parse success, field coverage, and heuristic quality vs baseline.
- Keep top-1 instruction per tool; include 1–3 few-shot demos if beneficial.
3. Integrate into TypeScript builders
- Replace static instruction blocks with optimized versions in existing files.
- Keep existing parsing and metadata logic unchanged.
4. Optional: Add batch GEPA for repo-search
- Microservice endpoint to return best outputs for batch tasks; wire `orchestrator.ts` to use it for large batches.

## Risks and Considerations
- Reflection LM availability and cost: use minimal budgets (`max_metric_calls` ~ 50–100) and small trainsets [1][5].
- Local-only constraint: if remote reflection LM is disallowed, fall back to MIPROv2, which uses traces without heavy reflection [3].
- Consistency: ensure optimized prompts still enforce strict JSON schema and avoid markdown per existing constraints.

## Success Criteria
- ≥15% reduction in format errors across pilot tools.
- ≥10% improvement in heuristic quality scores (findings completeness, summary relevance).
- Stable latency under current MLX settings.

## Citations
- [1] GEPA Overview (dspy.ai/api/optimizers/GEPA/overview/)
- [2] GEPA GitHub (github.com/gepa-ai/gepa)
- [3] DSPy Optimizers (dspy.ai/learn/optimization/optimizers/)
- [4] DSPy GEPA Tutorials (dspy.ai/tutorials/gepa_ai_program/)
- [5] HF Cookbook: DSPy GEPA (huggingface.co/learn/cookbook/dspy_gepa)