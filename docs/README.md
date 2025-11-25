# MLX-Powered Agentic RAG System

This repository implements Anthropic's "code execution with MCP" pattern end to end. It includes:

- A TypeScript MCP server (`mcp-server/`) that exposes progressive-disclosure tools over stdio
- A Python MLX backend (`mlx-servers/`) with an optimized load balancer and throughput-aware server manager
- Claude Code automation hooks (`hooks/`) and reusable skills (`skills/`)
- A single management script (`unified-system.sh`) that installs, boots, and wires everything into any repository you open in Claude Code

## Key Capabilities

- **Unified orchestration** – `unified-system.sh` replaces the old collection of shell scripts with one CLI that installs, starts, deploys, checks health, and wires hooks for any repo
- **Progressive disclosure tools** – Node/TypeScript tools in `mcp-server/src/tools/definitions/*` expose repo-search, code-analysis, architectural, and context-building primitives
- **MLX acceleration** – `mlx-servers/optimized_mlx_server.py` launches 27 Qwen3-VL-2B-Thinking workers (configurable) behind an HTTP load balancer on port 8090
- **Claude Code hooks & skills** – PreToolUse, PostToolUse, and SessionStart hooks (Node scripts) automatically gather context, validate changes, and analyze diffs while Claude Code is editing
- **Portable install** – By default everything is staged in `~/qwen3-claude-system` so you can point any repo at the same MCP stack without copying files

## Architecture

### Code Layout

```
vibethinker-code-execution/
├── unified-system.sh                # Main management CLI
├── mlx-servers/                     # MLX backend, load balancer, configs
├── mcp-server/                      # MCP server (tsc build)
├── hooks/                           # Claude Code hook scripts
├── skills/                          # Claude Code skills (Node entrypoints)
├── scripts/                         # Monitoring & conversion utilities
├── docs/                            # Guides (this file, deployment, etc.)
├── src/                             # Minimal TypeScript entry point
└── tests/                           # Integration smoke tests
```

### Runtime Data Flow

1. Claude Code spawns the MCP server (`mcp-server/dist/index.js`) over stdio.
2. The MCP server loads tool metadata from `servers/` and `mcp-server/src/tools/definitions/*` using progressive disclosure.
3. Tool executions call into the MLX load balancer on `http://localhost:8090`, which fans out to MLX workers listening on ports 8107 and up.
4. Hooks in `.claude/claude_settings.json` gather repo context before edits (`hooks/pre-tool-use/*.js`) and analyze diffs/tests after edits (`hooks/post-tool-use/*.js`).
5. Skills in `skills/` can be invoked with prompts such as `claude-code "skill: deep-repo-research --focus=security"` and run inside the same environment.

## Installation & Operation

### Prerequisites
- macOS on Apple Silicon (tested on M1/M2/M3)
- Python 3.10+ with `pip`
- Node.js 18+
- `pm2`, `ripgrep`, `fd`, and `ast-grep` available on the PATH (`brew install python@3.11 node@18 ripgrep fd ast-grep && npm install -g pm2`)

### Clone and Install
```bash
git clone <repository-url>
cd vibethinker-code-execution
npm install
chmod +x unified-system.sh
./unified-system.sh install --install-dir ~/qwen3-claude-system
```
Installation copies the MLX backend, MCP server, hooks, and skills into the install directory (`~/qwen3-claude-system` by default), installs Python + Node dependencies, builds the MCP server, and generates helper scripts (`setup-env.sh`, `start-system.sh`, `stop-system.sh`).

### Start the Stack
```bash
source ~/qwen3-claude-system/setup-env.sh
~/qwen3-claude-system/start-system.sh   # or ./unified-system.sh start
./unified-system.sh status              # lightweight health check
```
Services launched by the helper script:
- Optimized load balancer (`mlx-servers/optimized_load_balancer.py`, port 8090)
- Enhanced MLX server manager + workers (ports 8107+)
- MCP server (`mcp-server/dist/index.js`, stdio)
- Health/monitoring servers (`scripts/health-server.js`, `scripts/monitoring-dashboard.js`)

### Configure a Repository for Claude Code
From inside the repository Claude Code should edit:
```bash
/path/to/vibethinker-code-execution/unified-system.sh use
```
The `use` command:
- Writes `.claude/claude_settings.json` with the correct hook + MCP configuration
- Symlinks `.claude/hooks` and `.claude/skills` to the shared installation
- Creates `.claude/workspace/{cache,sessions,context}` for hook state
- Starts the MCP/MLX stack if it is not already running

After that, open the repo in Claude Code and run prompts normally; Claude will discover the MCP server automatically.

### Manual MCP Server Loop (for development)
```bash
cd mcp-server
npm install
npm run build
npm start    # runs dist/index.js and waits for stdio connections
```
This is handy when iterating on new tools while leaving the MLX backend running separately.

## Hooks & Skills Reference

| Component | Entry Point | Purpose |
|-----------|-------------|---------|
| PreToolUse – Context gatherer | `hooks/pre-tool-use/context-gatherer.js` | Builds dependency graphs and caches snippets before Claude edits |
| PreToolUse – Security validator | `hooks/pre-tool-use/security-validator.js` | Flags high-risk operations (secrets, migrations, etc.) |
| PostToolUse – Analyze changes | `hooks/post-tool-use/analyze-changes.js` | Summarizes diffs, affected modules, and test impact |
| PostToolUse – Update context | `hooks/post-tool-use/update-context.js` | Refreshes cached context files |
| PostToolUse – Run tests | `hooks/post-tool-use/run-tests.js` | Executes repo-specific test commands when heuristics suggest it |
| SessionStart | `hooks/session-start.js` | Scans the repo, validates environment, primes caches |
| SessionStop | `hooks/session-stop.js` | Tears down caches, archives session history |
| Skill – Deep repo research | `skills/deep-repo-research/index.js` | Multi-stage repo reconnaissance |
| Skill – Architectural analysis | `skills/architectural-analysis.js` | Pattern + component analysis with optional Markdown/graph output |
| Skill – Dependency analysis | `skills/dependency-analysis/index.js` | Builds dependency graphs and cycle reports |
| Skill – Context-aware editing | `skills/context-aware-editing/index.js` | Safeguarded editing helpers |

## Monitoring & Troubleshooting

```bash
./unified-system.sh status      # Quick port/health snapshot
./unified-system.sh health      # Adds MLX import test + throughput estimates
npm run health-check            # Python diagnostics in scripts/health_check.py
pm2 logs                        # Raw logs for MLX/Node processes
curl http://localhost:8090/metrics  # Load balancer metrics (JSON)
curl http://localhost:8090/health   # Health endpoint used by the manager
```

Common fixes:
- **MCP not connecting** – ensure `npm run build && npm start` has been run inside `mcp-server/` and that Claude Code was pointed at the repo containing `.claude/claude_settings.json`.
- **Hooks not firing** – rerun `./unified-system.sh use` from the repo root or open `.claude/claude_settings.json` to confirm the hook commands reference `$QWEN3_SYSTEM_DIR`.
- **Performance issues** – reduce `mlx_servers.instances` in `~/qwen3-claude-system/mlx-servers/config.json` and restart, or tweak `TARGET_THROUGHPUT` via `./unified-system.sh start --instances 12 --target-throughput 600`.

## Additional Resources
- `README.md` – high-level overview + quick start
- `QUICK_START.md` – step-by-step "one machine" guide
- `DEPLOYMENT_GUIDE.md` – comprehensive deployment + troubleshooting instructions
- `UNIFIED_SYSTEM_CONSOLIDATION.md` – technical rationale for the management script
- [MLX docs](https://ml-explore.github.io/mlx/), [Model Context Protocol](https://modelcontextprotocol.io/), [Claude Code docs](https://docs.anthropic.com/claude/docs/claude-code)
