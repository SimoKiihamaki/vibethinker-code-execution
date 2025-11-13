#!/bin/bash
# Portable Qwen3-VL-2B-Thinking System Setup for Any Repository

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
QWEN3_SYSTEM_DIR="${QWEN3_SYSTEM_DIR:-$HOME/qwen3-claude-system}"
CURRENT_DIR="$(pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}🚀 Qwen3-VL-2B-Thinking System Setup${NC}"
echo -e "${BLUE}======================================${NC}"

# Function to check if system is installed
check_system_installation() {
    if [ ! -d "$QWEN3_SYSTEM_DIR" ]; then
        echo -e "${RED}❌ Qwen3 system not found at $QWEN3_SYSTEM_DIR${NC}"
        echo -e "${YELLOW}💡 Please install the system first or set QWEN3_SYSTEM_DIR${NC}"
        exit 1
    fi

    if [ ! -f "$QWEN3_SYSTEM_DIR/venv/bin/activate" ]; then
        echo -e "${RED}❌ Python virtual environment not found${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ System installation found${NC}"
}

# Function to activate the system
activate_system() {
    echo -e "${BLUE}🔧 Activating Qwen3 system...${NC}"

    # Activate Python environment
    source "$QWEN3_SYSTEM_DIR/venv/bin/activate"

    # Set environment variables
    export QWEN3_SYSTEM_DIR
    export PATH="$QWEN3_SYSTEM_DIR/bin:$PATH"
    export PYTHONPATH="$QWEN3_SYSTEM_DIR:$PYTHONPATH"

    # Model configuration
    export MODEL_PATH="lmstudio-community/Qwen3-VL-2B-Thinking-MLX-8bit"
    export TEMPERATURE=1.0
    export TOP_P=0.95
    export TOP_K=20
    export REPETITION_PENALTY=1.0
    export PRESENCE_PENALTY=1.5

    # System configuration
    export MLX_INSTANCES=27
    export GPU_MEMORY_FRACTION=0.85

    echo -e "${GREEN}✅ System activated${NC}"
}

# Function to check if services are running
check_services() {
    echo -e "${BLUE}🔍 Checking system services...${NC}"

    # Check MCP server
    if curl -s http://localhost:8090/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ MCP Server running (port 8090)${NC}"
    else
        echo -e "${YELLOW}⚠️  MCP Server not running${NC}"
        return 1
    fi

    # Check load balancer
    if curl -s http://localhost:8091/status > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Load Balancer running (port 8091)${NC}"
    else
        echo -e "${YELLOW}⚠️  Load Balancer not running${NC}"
    fi

    # Check health monitor
    if curl -s http://localhost:8092/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Health Monitor running (port 8092)${NC}"
    else
        echo -e "${YELLOW}⚠️  Health Monitor not running${NC}"
    fi

    # Check MLX instances (sample)
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ MLX Instances running (port 8080+)${NC}"
    else
        echo -e "${YELLOW}⚠️  MLX Instances may not be running${NC}"
    fi
}

# Function to start services if needed
start_services() {
    echo -e "${BLUE}🚀 Starting system services...${NC}"

    cd "$QWEN3_SYSTEM_DIR"

    # Start services using PM2
    if ! pm2 list | grep -q "mlx-load-balancer"; then
        echo -e "${YELLOW}⚠️  Starting MLX services...${NC}"
        pm2 start ecosystem.config.js
        sleep 5
    fi

    # Check if services started successfully
    if check_services; then
        echo -e "${GREEN}✅ All services started successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Some services may need manual attention${NC}"
    fi
}

# Function to setup Claude Code integration
setup_claude_integration() {
    echo -e "${BLUE}🔗 Setting up Claude Code integration...${NC}"

    # Create .claude directory in current repo
    mkdir -p ".claude"

    # Create Claude Code configuration
    cat > ".claude/claude_settings.json" << EOF
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|Read",
        "hooks": [
          {
            "type": "command",
            "command": "node $QWEN3_SYSTEM_DIR/hooks/pre-tool-use/context-gatherer.js"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node $QWEN3_SYSTEM_DIR/hooks/post-tool-use/analyze-changes.js"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node $QWEN3_SYSTEM_DIR/hooks/session-start/load-repo-context.js"
          }
        ]
      }
    ]
  },
  "mcp": {
    "server_url": "http://localhost:8090",
    "model_config": {
      "temperature": 1.0,
      "top_p": 0.95,
      "max_tokens": 32768
    }
  },
  "skills": {
    "auto_load": true,
    "skills_path": "$QWEN3_SYSTEM_DIR/skills"
  }
}
EOF

    # Create skills directory link
    if [ ! -d ".claude/skills" ]; then
        ln -sf "$QWEN3_SYSTEM_DIR/skills" ".claude/skills"
    fi

    # Create hooks directory link
    if [ ! -d ".claude/hooks" ]; then
        ln -sf "$QWEN3_SYSTEM_DIR/hooks" ".claude/hooks"
    fi

    echo -e "${GREEN}✅ Claude Code integration configured${NC}"
}

# Function to initialize workspace
initialize_workspace() {
    echo -e "${BLUE}📁 Initializing workspace...${NC}"

    # Create workspace directories
    mkdir -p ".claude/workspace/cache"
    mkdir -p ".claude/workspace/sessions"
    mkdir -p ".claude/workspace/context"

    # Create workspace configuration
    cat > ".claude/workspace/config.json" << EOF
{
  "repo_path": "$CURRENT_DIR",
  "cache_enabled": true,
  "session_persistence": true,
  "auto_context_building": true,
  "skills_available": [
    "deep-repo-research",
    "architectural-analysis",
    "dependency-analysis",
    "context-aware-editing"
  ]
}
EOF

    echo -e "${GREEN}✅ Workspace initialized${NC}"
}

# Function to run system check
run_system_check() {
    echo -e "${BLUE}🔍 Running system check...${NC}"

    # Check Python environment
    if command -v python &> /dev/null; then
        python_version=$(python --version 2>&1 | cut -d' ' -f2)
        echo -e "${GREEN}✅ Python: $python_version${NC}"
    else
        echo -e "${RED}❌ Python not found${NC}"
    fi

    # Check Node.js
    if command -v node &> /dev/null; then
        node_version=$(node --version)
        echo -e "${GREEN}✅ Node.js: $node_version${NC}"
    else
        echo -e "${RED}❌ Node.js not found${NC}"
    fi

    # Check PM2
    if command -v pm2 &> /dev/null; then
        pm2_version=$(pm2 --version)
        echo -e "${GREEN}✅ PM2: $pm2_version${NC}"
    else
        echo -e "${RED}❌ PM2 not found${NC}"
    fi

    # Check MLX
    if python -c "import mlx" &> /dev/null; then
        mlx_version=$(python -c "import mlx; print(mlx.__version__)" 2>&1)
        echo -e "${GREEN}✅ MLX: $mlx_version${NC}"
    else
        echo -e "${RED}❌ MLX not found${NC}"
    fi
}

# Function to show usage information
show_usage_info() {
    echo -e "${BLUE}📖 Usage Information${NC}"
    echo -e "${BLUE}===================${NC}"
    echo ""
    echo -e "${GREEN}Your repository is now configured with Qwen3-VL-2B-Thinking!${NC}"
    echo ""
    echo -e "${YELLOW}Available Skills:${NC}"
    echo "  • deep-repo-research - Analyze repository structure and patterns"
    echo "  • architectural-analysis - Examine architecture and design"
    echo "  • dependency-analysis - Map dependencies and detect issues"
    echo "  • context-aware-editing - Edit with full context awareness"
    echo ""
    echo -e "${YELLOW}Example Usage:${NC}"
    echo "  claude-code \"Analyze this repository's architecture\""
    echo "  claude-code \"skill: deep-repo-research --focus=security\""
    echo "  claude-code \"Add authentication following existing patterns\""
    echo ""
    echo -e "${YELLOW}System Status:${NC}"
    echo "  MCP Server: http://localhost:8090"
    echo "  Health Monitor: http://localhost:8092"
    echo "  Load Balancer: http://localhost:8091"
    echo ""
    echo -e "${YELLOW}Management Commands:${NC}"
    echo "  pm2 list                    - Check service status"
    echo "  pm2 logs                    - View logs"
    echo "  npm run health-check        - System health check"
    echo ""
}

# Main execution
main() {
    echo -e "${GREEN}Setting up Qwen3-VL-2B-Thinking for repository:${NC}"
    echo -e "${GREEN}$CURRENT_DIR${NC}"
    echo ""

    # Run system check
    run_system_check
    echo ""

    # Check system installation
    check_system_installation
    echo ""

    # Activate system
    activate_system
    echo ""

    # Start services if needed
    if ! check_services; then
        start_services
        echo ""
        sleep 3
    fi

    # Setup Claude Code integration
    setup_claude_integration
    echo ""

    # Initialize workspace
    initialize_workspace
    echo ""

    # Final verification
    if check_services; then
        echo -e "${GREEN}🎉 Setup completed successfully!${NC}"
        echo ""
        show_usage_info
    else
        echo -e "${RED}❌ Setup completed with warnings${NC}"
        echo -e "${YELLOW}Please check the service logs for details${NC}"
    fi
}

# Handle command line arguments
case "${1:-}" in
    --check)
        run_system_check
        check_services
        ;;
    --start)
        activate_system
        start_services
        ;;
    --status)
        check_services
        ;;
    --help|-h)
        echo "Usage: $0 [--check|--start|--status|--help]"
        echo ""
        echo "Options:"
        echo "  --check   Check system requirements and services"
        echo "  --start   Start system services"
        echo "  --status  Show service status"
        echo "  --help    Show this help message"
        ;;
    *)
        main
        ;;
esac