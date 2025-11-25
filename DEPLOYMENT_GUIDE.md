# 🚀 Qwen3-VL-2B-Thinking System: Claude Code Deployment Guide

This document reflects the current codebase. It explains how to install the MCP/MLX stack, run it as a background service, and connect any repository you open in Claude Code.

## 📋 Overview

Components shipped in this repo:
- **`unified-system.sh`** – one CLI that installs, starts, deploys, checks health, and wires hooks
- **`mlx-servers/`** – MLX workers, optimized load balancer (port 8090), health checks
- **`mcp-server/`** – TypeScript MCP server that exposes progressive-disclosure tools over stdio
- **`hooks/` & `skills/`** – Claude Code automation for PreToolUse/PostToolUse/SessionStart plus reusable skills

## 🛠️ Step 1 – Prepare the machine

| Requirement | Command |
|-------------|---------|
| macOS on Apple Silicon | verified on M1/M2/M3 |
| Python 3.10+ | `brew install python@3.11` (or use the system Python 3.10+) |
| Node.js 18+ | `brew install node@18 && npm install -g pm2` |
| Tooling | `brew install ripgrep fd ast-grep` |

Verify the basics:
```bash
python3 --version    # >= 3.10
node --version       # >= 18
pip3 --version
npm --version
pm2 --version
```

## 📦 Step 2 – Clone and install

```bash
git clone <repository-url>
cd vibethinker-code-execution
npm install
chmod +x unified-system.sh
./unified-system.sh install --install-dir ~/qwen3-claude-system
```

`install` copies the MLX backend, MCP server, hooks, skills, and scripts into the target directory (default `~/qwen3-claude-system`), installs Python + Node dependencies, builds `mcp-server`, and generates helper scripts (`setup-env.sh`, `start-system.sh`, `stop-system.sh`).

## ▶️ Step 3 – Start the services

```bash
source ~/qwen3-claude-system/setup-env.sh
~/qwen3-claude-system/start-system.sh   # or ./unified-system.sh start
./unified-system.sh status              # confirms ports 8090/8091/8092 and MLX workers
```

What launches:
- Optimized load balancer (`mlx-servers/optimized_load_balancer.py`) – HTTP `/health` + `/metrics` on port 8090
- Enhanced MLX server manager + workers – default 27 instances on ports 8107–8133
- MCP server (`mcp-server/dist/index.js`) – stdio transport for Claude Code
- Health monitor + dashboard (`scripts/health-server.js`, `scripts/monitoring-dashboard.js`)

## 🪄 Step 4 – Attach Claude Code to any repo

From inside the repository you plan to open in Claude Code run:
```bash
/path/to/vibethinker-code-execution/unified-system.sh use
```

`use` (or `setup-hooks`) performs:
- Create `.claude/claude_settings.json` with the correct PreToolUse/PostToolUse/SessionStart hooks:
  - `node $QWEN3_SYSTEM_DIR/hooks/pre-tool-use/context-gatherer.js`
  - `node $QWEN3_SYSTEM_DIR/hooks/pre-tool-use/security-validator.js`
  - `node $QWEN3_SYSTEM_DIR/hooks/post-tool-use/analyze-changes.js`
  - `node $QWEN3_SYSTEM_DIR/hooks/post-tool-use/update-context.js`
  - `node $QWEN3_SYSTEM_DIR/hooks/post-tool-use/run-tests.js`
  - `node $QWEN3_SYSTEM_DIR/hooks/session-start.js`
- Symlink `.claude/hooks` and `.claude/skills` so updates propagate automatically
- Create `.claude/workspace/{cache,sessions,context}` for hook state
- Start the MCP/MLX stack if not already running

Open the repo in Claude Code and use prompts such as:
```bash
claude-code "skill: deep-repo-research --focus=security"
claude-code "Analyze the dependency graph for circular imports"
claude-code "Refactor the request handler without breaking auth"
```

## ✅ Step 5 – Validate & monitor

```bash
./unified-system.sh status           # Lightweight port/health snapshot
./unified-system.sh health           # Adds MLX import test + throughput scores
npm run health-check                 # Python diagnostics (scripts/health_check.py)
npm run setup-mcp                    # Builds + runs only the MCP server
curl http://localhost:8090/metrics   # JSON metrics from the load balancer
curl http://localhost:8090/health    # Used by hooks/session-start.js
pm2 logs                             # Tail MLX + MCP logs
```

## ⚙️ Configuration

### Environment helpers
`~/qwen3-claude-system/setup-env.sh` exports:
- `QWEN3_SYSTEM_DIR` – install directory, used inside `.claude/claude_settings.json`
- `MLX_INSTANCES`, `TARGET_THROUGHPUT`, `PORT_BASE` – defaults (27 instances, target 1485 tok/s, ports 8107+)
- Generation parameters: `MODEL_PATH`, `TEMPERATURE`, `TOP_P`, `TOP_K`, etc.

### MLX/Load-Balancer config
`~/qwen3-claude-system/mlx-servers/config.json` controls:
- `mlx_servers.instances`, `base_port`, `model_path`, quantization, batch size
- Load-balancer strategy (`least_connections`, health-check intervals, circuit breaker thresholds)
- Performance/monitoring toggles (request timeout, compression, metrics port)

Update the file and restart services via `./unified-system.sh restart`.

### Unified script overrides
All `unified-system.sh` commands accept:
- `--install-dir <path>` – use a non-default installation
- `--instances <n>` – override MLX worker count at runtime
- `--port-base <n>` – choose a different MLX port range
- `--target-throughput <n>` – change throughput goals used by the health check/deploy helpers

Examples:
```bash
./unified-system.sh start --instances 12 --port-base 9000
./unified-system.sh deploy --target-throughput 2000
./unified-system.sh clean --install-dir /opt/qwen3-stack
```

## 🛠️ Manual MCP development

When building new tools:
```bash
cd mcp-server
npm install
npm run build
npm start    # waits for stdio connections
```
Run `npm test` in the repo root to execute `vitest` + integration tests in `tests/integration/system.test.js`.

## 🚨 Troubleshooting

| Issue | Checks & fixes |
|-------|----------------|
| MCP server not found | `npm run setup-mcp` to rebuild, confirm Claude Code opened the repo containing `.claude/claude_settings.json` |
| Hooks never fire | Rerun `./unified-system.sh use`, ensure `$QWEN3_SYSTEM_DIR` in `.claude/claude_settings.json` matches your install path |
| Ports already in use | Start with `./unified-system.sh start --port-base 9000 --instances 8`; edit `mlx-servers/config.json` if you need the change to persist |
| Throughput below target | Run `./unified-system.sh health` to view actual numbers, ensure MLX dependencies (`mlx`, `mlx-lm`) are installed, verify GPU utilization |
| Need to remove everything | `./unified-system.sh uninstall` (prompts before deleting the install dir) |

## 📚 References
- `README.md` – architecture + management overview
- `QUICK_START.md` – condensed version of this guide
- `docs/README.md` – doc set index
- `UNIFIED_SYSTEM_CONSOLIDATION.md` – design notes for the management script
- External: [MLX](https://ml-explore.github.io/mlx/), [Model Context Protocol](https://modelcontextprotocol.io/), [Claude Code](https://docs.anthropic.com/claude/docs/claude-code)

With these steps the MCP server, MLX backend, hooks, and skills run exactly as implemented in the repo today – no hidden scripts or outdated commands required.
