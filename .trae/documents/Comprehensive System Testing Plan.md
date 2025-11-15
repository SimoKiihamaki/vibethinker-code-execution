## Objectives
- Validate all functional and non-functional requirements end-to-end
- Ensure JSON-only outputs, no prompt leakage, and consistent formatting
- Confirm stability, performance, and reliability under realistic workloads
- Establish repeatable regression testing and thorough documentation

## Scope & Components
- MCP Server: prompts, orchestrator parsing, sanitizeOutput, tool registry
- MLX Servers: mirrored tool prompts and output handling
- Tool Builders: repo-search, code-analysis, architectural, context-building
- Scripts/CLI: test clients and health-check utilities
- Existing tests: vitest config and integration tests

## Test Types
- Functional: unit, integration, system, end-to-end flows
- Non-functional: performance, load, scalability, reliability, security, usability
- Format compliance: JSON schema validation, plain text constraints, token usage

## Test Environment
- OS: macOS
- Node/Dependencies: clean install per package.json
- Repositories: run in project root; isolate caches; use deterministic seeds

## Acceptance Criteria
- All test cases pass
- No critical/high severity issues open
- Meets defined functional and non-functional requirements

## Severity Levels
- Critical: crash/data loss/security exposure; blocks core functionality
- High: major feature broken or incorrect outputs
- Medium: degraded functionality or intermittent issues
- Low: minor defects, cosmetic, non-blocking

## Test Plan
### Phase 1: Preparation
- Enumerate requirements: functional endpoints, output schemas, constraints
- Map tools to schemas and expected behaviors
- Define test data and repositories for realistic scenarios

### Phase 2: Functional Testing
- Unit tests
  - sanitizeOutput: removes fences/meta; respects word cap
  - extractFirstJson: parses embedded JSON correctly
  - prompt generation: constraint presence per tool
- Integration tests
  - MCP tool calls return schema-compliant JSON only
  - Orchestrator parses mixed outputs; cache behavior; token estimates
- End-to-end flows
  - Run representative tools across categories; verify outputs and next steps

### Phase 3: Non-Functional Testing
- Performance/load
  - Measure execution time, tokensUsed, memory
  - Load tools concurrently; confirm stable behavior
- Reliability
  - Repeat calls with varied inputs; ensure determinism at temperature 0.1
- Security
  - Ensure no secrets logged; paths sanitized; no command injection in inputs

### Phase 4: Manual Exploratory Testing
- Use CLI clients to exercise edge cases and unusual inputs
- Validate user ergonomics and error messaging

### Phase 5: Issue Tracking & Triage
- Document issues with severity, reproduction steps, environment details
- Prioritize critical/high first; create fix tasks

### Phase 6: Fixes & Regression
- Implement fixes per priority
- Run targeted regression after each fix
- Re-run full suite periodically to ensure no regressions

### Phase 7: Reporting & Documentation
- Maintain test run logs, coverage reports, performance metrics
- Summarize pass/fail, defects, resolutions, acceptance criteria status

## Test Case Examples
- JSON-only compliance
  - Tools return exact schema with no preface/suffix
  - Reject outputs containing “Your task:”, “Output format:”, fenced blocks
- Orchestrator parsing
  - Mixed text + JSON: extractFirstJson returns the JSON object
  - Non-JSON text: sanitizeOutput enforces constraints and caps length
- Tool-specific
  - buildGraph: metrics, issues, entryPoints, hotspots populated
  - detectIssues: severity distribution and file references
  - searchByQuery: results array with file/line/snippet

## Execution Plan
- Automate unit/integration with existing framework
- Manual checks for UX/security edge cases
- Daily triage and regression cycles until acceptance criteria met

## Deliverables
- Test plan and case catalog
- Automated test suites and scripts
- Defect reports with severity and reproduction steps
- Regression logs and final acceptance report