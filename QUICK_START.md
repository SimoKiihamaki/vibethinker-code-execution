# 🚀 Qwen3-VL-2B-Thinking System: Quick Start Guide

## ⚡ One-Command Setup

```bash
# Install the system (one-time)
./install-system.sh

# Start the system
~/qwen3-claude-system/start-system.sh

# Use in any repository
cd /path/to/your/project
~/qwen3-claude-system/use-qwen3-system.sh
```

## 📋 System Requirements

- **macOS**: Apple Silicon recommended (M1/M2/M3)
- **Python**: 3.10+
- **Node.js**: 18+
- **RAM**: 16GB+ (for 27 MLX instances)
- **Storage**: 10GB+

## 🎯 Usage Examples

### Basic Repository Analysis
```bash
cd your-project
~/qwen3-claude-system/use-qwen3-system.sh

# Claude Code now has enhanced capabilities
claude-code "Analyze this repository's architecture"
claude-code "What are the main components and how do they interact?"
```

### Using Skills
```bash
# Deep repository research
claude-code "skill: deep-repo-research --focus=security"

# Architectural analysis
claude-code "skill: architectural-analysis --focus=microservices"

# Dependency analysis
claude-code "skill: dependency-analysis --check-circular"

# Context-aware editing
claude-code "skill: context-aware-editing --file=src/api/users.js"
```

### Code Generation with Full Context
```bash
# Claude Code automatically:
# 1. Gathers file context via hooks
# 2. Uses Qwen3-VL-2B-Thinking for generation
# 3. Validates output with analysis

claude-code "Add a new API endpoint following existing patterns"
claude-code "Refactor this component for better performance"
```

## 🔧 System Services

| Service | Port | Description |
|---------|------|-------------|
| MCP Server | 8090 | Model Context Protocol |
| Load Balancer | 8091 | Request distribution |
| Health Monitor | 8092 | System health checks |
| MLX Instances | 8080+ | Qwen3 model instances |

## 📊 Management Commands

```bash
# Check service status
pm2 list

# View logs
pm2 logs mlx-server
pm2 logs mcp-server

# System health check
curl http://localhost:8090/health

# Stop all services
pm2 stop all

# Restart services
pm2 restart all
```

## 🎛️ Configuration

### Environment Variables
```bash
# Model settings
export TEMPERATURE=1.0
export TOP_P=0.95
export TOP_K=20

# System settings
export MLX_INSTANCES=27
export GPU_MEMORY_FRACTION=0.85
```

### Custom Configuration
```bash
# Edit model config
vim ~/qwen3-claude-system/mlx-servers/config.json

# Edit Claude Code settings
vim .claude/claude_settings.json
```

## 🔍 Available Skills

| Skill | Description | Usage |
|-------|-------------|-------|
| `deep-repo-research` | Comprehensive repository analysis | `skill: deep-repo-research --focus=topic` |
| `architectural-analysis` | System architecture review | `skill: architectural-analysis --focus=patterns` |
| `dependency-analysis` | Dependency mapping and analysis | `skill: dependency-analysis --check-circular` |
| `context-aware-editing` | Smart code editing with context | `skill: context-aware-editing --file=path` |

## 🔗 Available Hooks

| Hook | Trigger | Function |
|------|---------|----------|
| `context-gatherer` | PreToolUse | Gathers file context before operations |
| `security-validator` | PreToolUse | Checks for security risks |
| `dependency-checker` | PreToolUse | Validates dependencies |
| `analyze-changes` | PostToolUse | Analyzes impact of changes |
| `update-context` | PostToolUse | Updates context cache |
| `load-repo-context` | SessionStart | Loads repository information |

## 🚨 Troubleshooting

### Common Issues

#### System not starting
```bash
# Check system requirements
./install-system.sh --check

# Check logs
pm2 logs

# Manual restart
pm2 restart all
```

#### Model loading issues
```bash
# Test MLX installation
python -c "import mlx; print('MLX OK')"

# Test MLX-LM
python -c "import mlx_lm; print('MLX-LM OK')"

# Reinstall if needed
pip uninstall mlx mlx-lm
pip install mlx mlx-lm
```

#### Claude Code not connecting
```bash
# Check MCP server
curl http://localhost:8090/health

# Check configuration
cat .claude/claude_settings.json

# Re-run setup
~/qwen3-claude-system/use-qwen3-system.sh
```

#### Performance issues
```bash
# Reduce instance count
# Edit ~/qwen3-claude-system/mlx-servers/config.json
# Change "instances" from 27 to 12

# Check GPU usage
python -c "import mlx; print('GPU devices:', mlx.gpu.device_count())"

# Monitor memory
pm2 monit
```

## 📚 Documentation

- **Full Guide**: `DEPLOYMENT_GUIDE.md`
- **Configuration**: `mlx-servers/config.json`
- **Skills**: `~/qwen3-claude-system/skills/`
- **Hooks**: `~/qwen3-claude-system/hooks/`

## 🆘 Support

1. Check system logs: `pm2 logs`
2. Run health check: `curl http://localhost:8090/health`
3. Review requirements above
4. Check this guide for solutions
5. Create an issue in the repository

---

**🎉 Ready to supercharge Claude Code with Qwen3-VL-2B-Thinking!**