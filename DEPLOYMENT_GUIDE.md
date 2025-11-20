# 🚀 Qwen3-VL-2B-Thinking System: Claude Code Integration Guide

## 📋 Overview

This guide shows you how to deploy the Qwen3-VL-2B-Thinking powered system to work with Claude Code in any repository. The system provides:

- **🧠 Advanced AI**: Qwen3-VL-2B-Thinking model with MLX acceleration
- **🔧 MCP Server**: Model Context Protocol for seamless integration
- **⚡ Claude Code Hooks**: PreToolUse, PostToolUse, SessionStart automation
- **🎯 Reusable Skills**: Deep repo research, architectural analysis, etc.
- **📁 Progressive Discovery**: Tools that load on-demand

## 🛠️ Prerequisites

### System Requirements
- **macOS**: Apple Silicon (M1/M2/M3) recommended
- **RAM**: 16GB+ (for 27 MLX instances)
- **Storage**: 10GB+ free space
- **Python**: 3.10+
- **Node.js**: 18+

### Required Tools
```bash
# Install system dependencies
brew install python@3.11 node@18 ripgrep fd ast-grep pm2

# Install MLX for Apple Silicon
pip install mlx mlx-lm

# Verify installation
python -c "import mlx; print('MLX installed successfully')"
```

## 📦 Quick Deployment (One-Time Setup)

### Step 1: Clone and Setup the System
```bash
# Clone the repository
git clone <your-repo-url> qwen3-claude-system
cd qwen3-claude-system

# Setup Python environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install Node.js dependencies
npm install
npm run build
```

### Step 2: Start the System
```bash
# Start all services
./start_optimized_system.sh

# Verify everything is running
pm2 list
npm run health-check
```

### Step 3: Configure Claude Code
```bash
# Create Claude Code config directory
mkdir -p ~/.claude

# Add the system to Claude Code
echo 'export CLAUDE_TOOLS_PATH="/path/to/qwen3-claude-system"' >> ~/.zshrc
echo 'export PATH="$PATH:/path/to/qwen3-claude-system/bin"' >> ~/.zshrc
source ~/.zshrc
```

## 🔧 Using in Any Repository

### Method 1: Portable Script (Recommended)
```bash
# In any repository, run:
/use-qwen3-system.sh

# This will:
# 1. Start the MCP server
# 2. Configure Claude Code hooks
# 3. Load available skills
# 4. Connect to Claude Code
```

### Method 2: Manual Setup
```bash
# 1. Navigate to your repository
cd /path/to/your/project

# 2. Link the system
ln -s /path/to/qwen3-claude-system/.claude .claude

# 3. Start MCP server
/path/to/qwen3-claude-system/scripts/start-mcp-server.sh

# 4. Configure hooks
/path/to/qwen3-claude-system/scripts/setup-hooks.sh
```

## 🎯 Available Skills and Hooks

### Skills (Reusable AI Capabilities)
```bash
# Deep repository research
claude-code "skill: deep-repo-research --analyze-authentication"

# Architectural analysis
claude-code "skill: architectural-analysis --focus=microservices"

# Dependency analysis
claude-code "skill: dependency-analysis --check-circular"

# Code review
claude-code "skill: context-aware-editing --file=src/api/users.js"
```

### Hooks (Automatic Triggers)
```bash
# PreToolUse: Runs before any file operation
# - Gathers context
# - Validates dependencies
# - Checks for breaking changes

# PostToolUse: Runs after file operations
# - Analyzes impact
# - Runs tests
# - Updates documentation

# SessionStart: Runs when Claude Code starts
# - Loads repo context
# - Builds dependency graph
# - Initializes workspace

# Stop: Runs when session ends
# - Saves session state
# - Updates learned patterns
```

## 📊 System Components

### Core Services
- **MLX Servers**: 27 instances of Qwen3-VL-2B-Thinking (ports 8107-8133)
- **MCP Server**: Model Context Protocol server (stdio)
- **Load Balancer**: Intelligent request distribution (port 8090)
- **Health Monitor**: System health checking (port 8080)

### Configuration
```json
{
  "model": "Qwen3-VL-2B-Thinking-MLX-8bit",
  "instances": 27,
  "generation": {
    "temperature": 1.0,
    "top_p": 0.95,
    "top_k": 20,
    "max_tokens": 32768
  },
  "performance": {
    "throughput": "1200 tokens/sec",
    "memory": "1.2GB per instance"
  }
}
```

## 🚀 Usage Examples

### Example 1: Repository Analysis
```bash
cd your-project
/use-qwen3-system.sh

# Claude Code now has enhanced capabilities:
claude-code "Analyze this repository's architecture and identify potential improvements"
```

### Example 2: Code Generation with Context
```bash
# Claude Code automatically:
# 1. Gathers file context via hooks
# 2. Uses Qwen3-VL-2B-Thinking for generation
# 3. Validates output with analysis

claude-code "Add a new API endpoint for user management following existing patterns"
```

### Example 3: Deep Code Review
```bash
# Use the deep-repo-research skill
claude-code "skill: deep-repo-research --focus=security --output=security-report.md"
```

## 🔍 Monitoring and Management

### Check System Status
```bash
# Check all services
pm2 list

# Check health
curl http://localhost:8092/health

# View logs
pm2 logs mlx-server
pm2 logs mcp-server
```

### Performance Metrics
```bash
# System metrics
curl http://localhost:8090/metrics

# Load balancer stats
curl http://localhost:8091/stats
```

## ⚙️ Configuration

### Environment Variables
```bash
# Model configuration
export MODEL_PATH="lmstudio-community/Qwen3-VL-2B-Thinking-MLX-8bit"
export TEMPERATURE=1.0
export TOP_P=0.95

# System configuration
export MLX_INSTANCES=27
export GPU_MEMORY_FRACTION=0.85

# Claude Code integration
export CLAUDE_HOOKS_ENABLED=true
export SKILLS_AUTO_LOAD=true
```

### Custom Configuration
```bash
# Edit main config
vim mlx-servers/config.json

# Edit Claude Code settings
vim ~/.claude/claude_settings.json

# Customize skills
vim skills/custom/your-skill.md
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Model Not Loading
```bash
# Check MLX installation
python -c "import mlx; print(mlx.__version__)"

# Check model availability
python -c "from mlx_lm import load; print('MLX-LM working')"
```

#### 2. MCP Server Not Connecting
```bash
# Check if MCP server is running
lsof -i :8090

# Restart MCP server
pm2 restart mcp-server

# Check Claude Code connection
claude-code --version
```

#### 3. Hooks Not Triggering
```bash
# Verify hook installation
ls -la ~/.claude/hooks/

# Test hooks manually
node hooks/pre-tool-use/context-gatherer.js test

# Check hook configuration
cat ~/.claude/hooks_config.json
```

#### 4. Performance Issues
```bash
# Check GPU utilization
python -c "import mlx; print(mlx.gpu.device_count())"

# Monitor memory usage
pm2 monit

# Optimize instances
# Edit mlx-servers/config.json to reduce instance count
```

## 🔧 Advanced Usage

### Custom Skills
```bash
# Create a new skill
mkdir skills/your-skill
echo "name: your-skill" > skills/your-skill/SKILL.md
echo "description: Your custom skill" >> skills/your-skill/SKILL.md

# Implement skill logic
touch skills/your-skill/implementation.js

# Test skill
claude-code "skill: your-skill --test"
```

### Custom Hooks
```bash
# Create a custom hook
mkdir hooks/custom/your-hook
echo "console.log('Custom hook running')" > hooks/custom/your-hook/index.js

# Register hook
echo '{"name": "your-hook", "script": "hooks/custom/your-hook/index.js"}' >> ~/.claude/hooks_config.json
```

## 📚 Additional Resources

- **MLX Documentation**: https://ml-explore.github.io/mlx/
- **Claude Code Guide**: https://docs.anthropic.com/claude/docs/claude-code
- **Model Context Protocol**: https://modelcontextprotocol.io/
- **Qwen3-VL Model**: https://huggingface.co/Qwen/Qwen3-VL-2B-Thinking

## 🆘 Support

If you encounter issues:

1. Check the logs: `pm2 logs`
2. Run health check: `npm run health-check`
3. Check system requirements
4. Review this guide for common solutions
5. Create an issue in the repository

---

**🎉 Congratulations! You now have Qwen3-VL-2B-Thinking enhanced Claude Code working across all your repositories!**