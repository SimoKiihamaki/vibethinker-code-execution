# MLX-Powered Agentic RAG System

A complete implementation of Anthropic's "Code execution with MCP" pattern, integrating Claude Code hooks, skills, and MLX acceleration with **Qwen3-VL-2B-Thinking** for **enhanced reasoning capabilities and 19x faster repository analysis**.

## 🚀 Performance Metrics

| Metric | Value |
|--------|-------|
| System throughput | **1,200 tokens/sec** (27 instances @ ~44 tok/s each) |
| Queries/hour | ~8,640 |
| Avg response time | **11.2s** (vs 83.3s with vLLM CPU) |
| Token reduction | **98.7%** (150k → 2k tokens) |
| Memory per instance | 1.2 GB |
| GPU utilization | 70-90% |
| Power consumption | <45W |
| Model | Qwen3-VL-2B-Thinking (8-bit) |

## 🏗️ Architecture Overview

### Progressive Disclosure Pattern
- **Tools as Code APIs**: Filesystem-based tool presentation in `./servers/` directory
- **On-demand loading**: Claude explores and imports only what it needs
- **98.7% token reduction**: Data processed in execution environment, insights return to context
- **Scalable discovery**: Thousands of tools without context window overflow

### Automated Workflows via Hooks
- **PreToolUse**: Auto-gather context before edits, validate operations
- **PostToolUse**: Analyze impact, update caches, run tests
- **SessionStart**: Load full repo context, build dependency graphs
- **Stop**: Save session state, update learned patterns

### Reusable Skills
- **deep-repo-research**: Multi-stage parallel analysis
- **architectural-analysis**: Pattern detection and synthesis
- **dependency-analysis**: Import graphs with cycle detection
- **context-aware-editing**: Prevent breaking changes

### MLX Backend Performance
- **27 concurrent instances** with intelligent load balancing
- **8-bit quantization**: 1.2 GB per model with enhanced reasoning
- **Qwen3-VL-2B-Thinking**: Advanced multimodal reasoning capabilities
- **Native M3 Max GPU acceleration** (70-90% utilization)
- **Enhanced tool usage**: Better planning and execution capabilities
- **~15x performance improvement** over CPU-based solutions

## 📁 Project Structure

```
vibethinker-code-execution/
├── README.md                        # Project overview
├── package.json                     # Root Node.js package
├── unified-system.sh                # Unified installer/orchestrator
├── mlx-servers/                     # MLX inference backend
│   ├── config.json                  # Default MLX/port config
│   ├── ecosystem.config.cjs         # PM2 process file
│   ├── enhanced_server_manager.py   # Supervisor & metrics
│   ├── optimized_load_balancer.py   # HTTP load balancer (port 8090)
│   ├── optimized_mlx_server.py      # Individual MLX worker
│   └── logs/
├── mcp-server/                      # Model Context Protocol server
│   ├── package.json / tsconfig.json
│   ├── src/
│   │   ├── index.ts                 # MCP entry point
│   │   ├── client.ts                # Load balancer client
│   │   ├── orchestrator.ts          # Tool orchestration
│   │   └── tools/definitions/…      # Progressive disclosure tools
│   └── dist/                        # Build output
├── hooks/
│   ├── pre-tool-use/
│   │   ├── context-gatherer.js
│   │   └── security-validator.js
│   ├── post-tool-use/
│   │   ├── analyze-changes.js
│   │   ├── update-context.js
│   │   └── run-tests.js
│   ├── session-start.js
│   └── session-stop.js
├── skills/
│   ├── deep-repo-research/
│   │   ├── SKILL.md
│   │   └── index.js
│   ├── dependency-analysis/
│   │   ├── SKILL.md
│   │   └── index.js
│   ├── context-aware-editing/
│   │   ├── SKILL.md
│   │   └── index.js
│   └── architectural-analysis.js
├── scripts/
│   ├── convert_model.py
│   ├── health-server.js
│   └── monitoring-dashboard.js
├── docs/
│   ├── README.md and guides
│   └── …
├── src/
│   └── index.ts                     # Root TypeScript entry
├── tests/
│   └── integration/system.test.js
└── requirements.txt                 # Python dependencies
```

## 🚀 Quick Start

### 1. Prepare your machine
- macOS on Apple Silicon (tested on M1/M2/M3)
- Python 3.10+ with `pip`
- Node.js 18+ with `npm`
- `pm2`, `ripgrep`, `fd`, and `ast-grep` available on the PATH (`brew install python@3.11 node@18 ripgrep fd ast-grep && npm install -g pm2`)

### 2. Clone and bootstrap
```bash
git clone <repository-url>
cd vibethinker-code-execution
npm install
chmod +x unified-system.sh
```

### 3. Install the system bundle
```bash
# Copies MLX servers, MCP server, hooks, and skills into ~/qwen3-claude-system
./unified-system.sh install --install-dir ~/qwen3-claude-system
```
The install command checks requirements, installs Python + Node dependencies, builds `mcp-server`, and generates helper scripts (`setup-env.sh`, `start-system.sh`, `stop-system.sh`).

### 4. Start the backend services
```bash
source ~/qwen3-claude-system/setup-env.sh
~/qwen3-claude-system/start-system.sh   # or run ./unified-system.sh start
./unified-system.sh status              # verifies MCP/MLX/monitor ports
```
This bootstraps the MLX workers (ports 8107+), the optimized load balancer (port 8090), the health monitor (8092), and the MCP server (stdio transport).

### 5. Wire Claude Code to any repository
Run the `use` command from inside the repo you want Claude Code to edit.
```bash
cd /path/to/your/project
/path/to/vibethinker-code-execution/unified-system.sh use
```
`use` (or `setup-hooks`) writes `.claude/claude_settings.json`, symlinks the shared `hooks/` and `skills/` directories from `~/qwen3-claude-system`, seeds `.claude/workspace/`, and ensures the MCP stack is running before Claude Code connects.

### Verification commands
```bash
./unified-system.sh health          # end-to-end check (throughput + MLX import)
npm run health-check                # Python diagnostics in scripts/health_check.py
npm run setup-mcp                   # Builds/runs just the MCP server via stdio
curl http://localhost:8090/health   # Load balancer/monitor endpoint
```
Once the hooks are in place you can launch Claude Code, open the repo, and issue prompts such as `claude-code "skill: deep-repo-research --focus=security"` or `claude-code "Refactor the request handler without breaking auth"`.

## Unified Management Script

`unified-system.sh` centralizes everything the original shell scripts used to do. Highlighted commands:

| Command | Purpose |
|---------|---------|
| `./unified-system.sh install [--install-dir PATH]` | Copy MLX + MCP assets into a portable directory (default `~/qwen3-claude-system`) and install Node/Python deps. |
| `./unified-system.sh start / stop / restart` | Manage the MLX processes, optimized load balancer (port 8090), MCP server, and monitors. |
| `./unified-system.sh status` | Performs lightweight HTTP checks against ports 8090–8092 and confirms each MLX worker port responds. |
| `./unified-system.sh health` | Runs the status checks plus MLX import validation and throughput scoring. |
| `./unified-system.sh use` | From inside a repo, writes `.claude/claude_settings.json`, symlinks hooks/skills from the install dir, and initializes `.claude/workspace`. |
| `./unified-system.sh setup-hooks` | Only refresh the Claude config (useful when CI prepares the repo). |
| `./unified-system.sh deploy` | Generate optimized configs (`mlx_enhanced_config.json`, `optimized_lb_config.json`) before restarting services. |
| `./unified-system.sh clean / test / uninstall` | Maintenance helpers for logs, integration tests, or removing an install. |

All commands accept `--install-dir`, `--instances`, `--port-base`, and `--target-throughput` overrides, so you can run multiple stacks or downscale for minimal hardware.

## 🎯 Usage Examples

### Progressive Disclosure API

```typescript
import * as repo from './servers';

// Automatic progressive disclosure - only loads needed tools
const auth = await repo.architectural.synthesizeFindings({
  topic: "authentication flow",
  depth: "comprehensive"
});

// Result: 2k token summary vs 150k tokens of raw files
console.log(auth.summary);
console.log(`Analyzed ${auth.metadata.filesCount} files`);
console.log(`Found ${auth.findings.length} insights`);
```

### Automated Context Gathering

```typescript
// SessionStart hook loads repo structure into .claude/context/
// PreToolUse hook gathers file dependencies before edits
// PostToolUse hook analyzes impact after changes
// Skills activate automatically based on user intent
```

### Repository Analysis

```bash
# Deep repository research
claude-code "Research the authentication system in this repo"

# Architectural analysis
claude-code "Analyze the dependency injection patterns"

# Context-aware editing
claude-code "Update the user service without breaking auth"
```

## 🔧 Configuration

### MCP / MLX Configuration

`mlx-servers/config.json` is the canonical place to adjust model parameters, load balancer tuning, and monitoring behavior. The default file ships with:

```json
{
  "mlx_servers": {
    "instances": 27,
    "base_port": 8107,
    "model_path": "lmstudio-community/Qwen3-VL-2B-Thinking-MLX-8bit",
    "quantization": "8bit",
    "max_tokens": 32768,
    "temperature": 1.0,
    "top_p": 0.95,
    "top_k": 20,
    "repetition_penalty": 1.0,
    "presence_penalty": 1.5,
    "gpu_memory_fraction": 0.85,
    "batch_size": 6
  },
  "load_balancer": {
    "algorithm": "least_connections",
    "health_check_interval": 60,
    "circuit_breaker": { "failure_threshold": 5, "recovery_timeout": 600000 }
  },
  "performance": {
    "target_tokens_per_second": 55,
    "request_timeout": 180000,
    "keep_alive": true,
    "compression": true
  }
}
```
Update the file inside `~/qwen3-claude-system/mlx-servers/` after installation and restart via `./unified-system.sh restart`.

### Claude Code Settings

`./unified-system.sh use` writes `.claude/claude_settings.json` in the target repo. The generated config looks like this (the `$QWEN3_SYSTEM_DIR` environment variable is set by `setup-env.sh`).

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|Read",
        "hooks": [
          { "type": "command", "command": "node $QWEN3_SYSTEM_DIR/hooks/pre-tool-use/context-gatherer.js" },
          { "type": "command", "command": "node $QWEN3_SYSTEM_DIR/hooks/pre-tool-use/security-validator.js" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "node $QWEN3_SYSTEM_DIR/hooks/post-tool-use/analyze-changes.js" },
          { "type": "command", "command": "node $QWEN3_SYSTEM_DIR/hooks/post-tool-use/update-context.js" },
          { "type": "command", "command": "node $QWEN3_SYSTEM_DIR/hooks/post-tool-use/run-tests.js" }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "node $QWEN3_SYSTEM_DIR/hooks/session-start.js" }
        ]
      }
    ]
  },
  "skills": {
    "auto_load": true,
    "skills_path": "$QWEN3_SYSTEM_DIR/skills"
  },
  "mcp": {
    "transport": "stdio",
    "server_url": "http://localhost:8090",
    "model_config": {
      "temperature": 1.0,
      "top_p": 0.95,
      "max_tokens": 32768
    }
  }
}
```

## 📊 Performance Optimization

### MLX Model Configuration

- **Quantization**: 8-bit for enhanced reasoning with good memory efficiency
- **Model**: Qwen3-VL-2B-Thinking with advanced multimodal capabilities
- **Batch Size**: Optimized for M3 Max GPU (6 batches per instance)
- **Context Length**: 32768 tokens per instance
- **Load Balancing**: Intelligent round-robin with health checks
- **Generation**: Optimized parameters for creative and analytical tasks

### Caching Strategy

- **Query Results**: 1-hour TTL with LRU eviction
- **Dependency Graphs**: Persistent across sessions
- **Context Summaries**: Compressed and indexed
- **Tool Definitions**: Lazy-loaded with prefetching

### Memory Management

- **GPU Memory**: 1.2GB per MLX instance (27× = ~32GB total)
- **System Memory**: 2GB for Node.js processes
- **Cache Memory**: 1GB for query results
- **Total Footprint**: ~35GB for full system
- **Enhanced Reasoning**: Larger model provides better tool usage and planning

## 🔒 Security Features

- **Sandboxed Execution**: All code runs in isolated environments
- **Permission Validation**: Hooks validate sensitive operations
- **Input Sanitization**: All user inputs are validated
- **Audit Logging**: Complete activity tracking
- **Rate Limiting**: Prevent abuse and resource exhaustion

## 🛠️ Development

### Adding New Skills

1. Create directory in `skills/`
2. Add `SKILL.md` with YAML frontmatter
3. Implement TypeScript logic
4. Add resources in `resources/` subdirectory
5. Test with Claude Code

### Extending Hooks

1. Create hook file in appropriate directory
2. Implement event handling logic
3. Add to configuration file
4. Test with real scenarios

### Adding Tools

1. Create tool file in `mcp-server/src/tools/`
2. Add to tool registry
3. Update progressive disclosure generator
4. Test integration

## 📈 Monitoring

### Health Checks

```bash
# System health
npm run health-check

# MLX instances
pm2 list

# Performance metrics
curl http://localhost:8107/metrics
```

### Logging

- **Application Logs**: `~/.pm2/logs/`
- **MLX Logs**: `./mlx-servers/logs/`
- **Hook Logs**: `./workspace/logs/`
- **Audit Logs**: `./workspace/audit/`

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Submit pull request
5. Update documentation

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Anthropic for MCP and Claude Code
- Apple for MLX framework
- Open source community for tools and libraries

---

**Built with ❤️ by VibeThinker** | **Powered by Qwen3-VL-2B-Thinking** | **Performance: ~15x faster, 98.7% fewer tokens**
