# 🚀 Qwen3-VL-2B-Thinking System: Quick Start Guide

This guide mirrors what the code actually does today. Follow it to install the MCP/MLX stack and make it available in any repository you open in Claude Code.

## 0. Prerequisites

| Requirement | Notes |
|-------------|-------|
| macOS on Apple Silicon | Tested on M1/M2/M3 |
| Python 3.10+ + `pip` | Used by `mlx-servers` scripts and health checks |
| Node.js 18+ + `npm` | Builds/runs the MCP server and hooks |
| CLI tools | `pm2`, `ripgrep`, `fd`, `ast-grep` (install via `brew install python@3.11 node@18 ripgrep fd ast-grep && npm install -g pm2`) |

## 1. Install the system bundle

```bash
git clone <repository-url>
cd vibethinker-code-execution
npm install
chmod +x unified-system.sh
./unified-system.sh install --install-dir ~/qwen3-claude-system
```

What the installer does:
- Copies `mlx-servers/`, `mcp-server/`, `hooks/`, `skills/`, and helper scripts into `~/qwen3-claude-system`
- Installs Python + Node dependencies (`mlx`, `mlx-lm`, `pm2`, etc.)
- Builds the TypeScript MCP server so `dist/index.js` is ready for Claude Code
- Generates `setup-env.sh`, `start-system.sh`, and `stop-system.sh` in the install directory

## 2. Start the backend services

```bash
source ~/qwen3-claude-system/setup-env.sh
~/qwen3-claude-system/start-system.sh   # or ./unified-system.sh start
./unified-system.sh status              # health snapshot
```

This launches:
- Optimized load balancer (`mlx-servers/optimized_load_balancer.py`, port 8090)
- Enhanced MLX server manager + workers (ports 8107+ by default)
- MCP server (`mcp-server/dist/index.js`, stdio transport)
- Health monitor + dashboard (`scripts/health-server.js`, `scripts/monitoring-dashboard.js`)

## 3. Wire Claude Code into any repository

Execute the `use` command from the root of the repository you want to analyze/edit.

```bash
cd /path/to/your/project
/path/to/vibethinker-code-execution/unified-system.sh use
```

`use` performs the steps that the docs previously attributed to `use-qwen3-system.sh`:
- Writes `.claude/claude_settings.json` with the correct PreToolUse, PostToolUse, and SessionStart hook commands pointing at `$QWEN3_SYSTEM_DIR`
- Symlinks `.claude/hooks` and `.claude/skills` to the shared install so updates propagate automatically
- Seeds `.claude/workspace/{cache,sessions,context}`
- Starts the MCP/MLX stack if it was offline

Open the repo in Claude Code and issue prompts such as:

```bash
claude-code "skill: deep-repo-research --focus=security"
claude-code "Refactor the auth middleware without breaking tests"
```

## 4. Useful follow-up commands

```bash
./unified-system.sh health          # Throughput + MLX import validation
npm run health-check                # Python diagnostics (scripts/health_check.py)
npm run setup-mcp                   # Build + run only the MCP server
curl http://localhost:8090/health   # Load balancer/monitor endpoint
pm2 logs                            # Tail MLX + MCP logs once started by the helper scripts
```

## 5. Manual MCP development loop

When iterating on new tools you can run the MCP server in isolation.

```bash
cd mcp-server
pnpm install
pnpm run build
pnpm start   # waits for stdio connections (Claude Code or tests)

# Run the test suite (239 tests)
pnpm test

# Run with coverage
pnpm test -- --coverage

# Type checking
pnpm tsc --noEmit
```

## 6. Customization knobs

- `~/qwen3-claude-system/mlx-servers/config.json` – change `instances`, `base_port`, or generation parameters
- `./unified-system.sh start --instances 12 --port-base 9000` – override runtime options without editing JSON
- `./unified-system.sh setup-hooks` – refresh the `.claude` configuration without touching workspace data
- `./unified-system.sh deploy` – generate `mlx_enhanced_config.json` and `optimized_lb_config.json` with new throughput targets, then restart services

## 7. Troubleshooting cheatsheet

| Symptom | Fix |
|---------|-----|
| Claude Code says "no MCP server" | Confirm `./unified-system.sh status` passes, then rerun `./unified-system.sh use` in the repo |
| Hooks do not run | Inspect `.claude/claude_settings.json` and ensure the `command` paths point at `$QWEN3_SYSTEM_DIR`; rerun `use` |
| Ports are already in use | Pass alternative ports: `./unified-system.sh start --port-base 9000 --instances 8` |
| System feels slow | Lower `mlx_servers.instances` in `mlx-servers/config.json`, or run `./unified-system.sh start --instances 12 --target-throughput 600` |

You now have the same workflow described in the code—no hidden scripts required.
