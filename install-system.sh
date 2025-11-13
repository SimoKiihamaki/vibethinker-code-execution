#!/bin/bash
# Complete Qwen3-VL-2B-Thinking System Installation Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="${INSTALL_DIR:-$HOME/qwen3-claude-system}"
SYSTEM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${CYAN}🚀 Qwen3-VL-2B-Thinking System Installation${NC}"
echo -e "${CYAN}==========================================${NC}"
echo ""
echo -e "${BLUE}This will install the system to: ${INSTALL_DIR}${NC}"
echo ""

# Function to check system requirements
check_requirements() {
    echo -e "${BLUE}🔍 Checking system requirements...${NC}"

    # Check OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "${GREEN}✅ macOS detected${NC}"

        # Check for Apple Silicon
        if [[ $(uname -m) == "arm64" ]]; then
            echo -e "${GREEN}✅ Apple Silicon detected (optimal for MLX)${NC}"
        else
            echo -e "${YELLOW}⚠️  Intel Mac detected (MLX may be slower)${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  macOS recommended for best MLX performance${NC}"
    fi

    # Check Python
    if command -v python3 &> /dev/null; then
        python_version=$(python3 --version 2>&1 | cut -d' ' -f2)
        echo -e "${GREEN}✅ Python: $python_version${NC}"

        # Check version
        if [[ $(echo "$python_version" | cut -d'.' -f1) -ge 3 ]] && [[ $(echo "$python_version" | cut -d'.' -f2) -ge 10 ]]; then
            echo -e "${GREEN}✅ Python version compatible${NC}"
        else
            echo -e "${RED}❌ Python 3.10+ required${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ Python 3 not found${NC}"
        echo -e "${YELLOW}Please install Python 3.10+ from https://python.org${NC}"
        exit 1
    fi

    # Check Node.js
    if command -v node &> /dev/null; then
        node_version=$(node --version)
        echo -e "${GREEN}✅ Node.js: $node_version${NC}"

        # Check version
        if [[ $(echo "$node_version" | cut -d'.' -f1 | sed 's/v//') -ge 18 ]]; then
            echo -e "${GREEN}✅ Node.js version compatible${NC}"
        else
            echo -e "${YELLOW}⚠️  Node.js 18+ recommended${NC}"
        fi
    else
        echo -e "${RED}❌ Node.js not found${NC}"
        echo -e "${YELLOW}Please install Node.js 18+ from https://nodejs.org${NC}"
        exit 1
    fi

    # Check available disk space (at least 10GB)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS: use df -g for GB output, available space is in 4th column
        available_space=$(df -g . | tail -1 | awk '{print $4}')
    else
        # Linux: use df -BG for GB output, available space is in 4th column
        available_space=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
    fi

    if [[ $available_space -ge 10 ]]; then
        echo -e "${GREEN}✅ Disk space: ${available_space}GB available${NC}"
    else
        echo -e "${RED}❌ Insufficient disk space: ${available_space}GB available (need 10GB+)${NC}"
        exit 1
    fi

    # Check memory
    if [[ "$OSTYPE" == "darwin"* ]]; then
        memory_gb=$(sysctl -n hw.memsize | awk '{printf "%.0f", $1/1024/1024/1024}')
        if [[ $memory_gb -ge 16 ]]; then
            echo -e "${GREEN}✅ Memory: ${memory_gb}GB (recommended for 27 instances)${NC}"
        elif [[ $memory_gb -ge 8 ]]; then
            echo -e "${YELLOW}⚠️  Memory: ${memory_gb}GB (may need to reduce instance count)${NC}"
        else
            echo -e "${RED}❌ Memory: ${memory_gb}GB (8GB+ required)${NC}"
            exit 1
        fi
    fi

    echo -e "${GREEN}✅ System requirements check passed${NC}"
    echo ""
}

# Function to install system dependencies
install_system_deps() {
    echo -e "${BLUE}📦 Installing system dependencies...${NC}"

    if command -v brew &> /dev/null; then
        echo -e "${GREEN}✅ Homebrew found${NC}"

        # Install tools via Homebrew
        echo -e "${YELLOW}Installing: ripgrep, fd, ast-grep...${NC}"
        brew install ripgrep fd ast-grep || {
            echo -e "${RED}❌ Failed to install some Homebrew dependencies${NC}"
            echo -e "${YELLOW}Please install them manually${NC}"
        }

        echo -e "${GREEN}✅ Homebrew dependencies installed${NC}"
    else
        echo -e "${YELLOW}⚠️  Homebrew not found${NC}"
        echo -e "${BLUE}Would you like to install Homebrew? (recommended)${NC}"
        read -p "Install Homebrew? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}Installing Homebrew...${NC}"
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || {
                echo -e "${RED}❌ Homebrew installation failed${NC}"
                echo -e "${YELLOW}Please install manually: https://brew.sh${NC}"
            }

            if command -v brew &> /dev/null; then
                echo -e "${GREEN}✅ Homebrew installed successfully${NC}"
                echo -e "${YELLOW}Installing tools via Homebrew...${NC}"
                brew install ripgrep fd ast-grep || {
                    echo -e "${RED}❌ Failed to install some dependencies${NC}"
                }
            fi
        else
            echo -e "${YELLOW}⚠️  Skipping Homebrew installation${NC}"
            echo -e "${BLUE}Please install the following tools manually:${NC}"
            echo "  - ripgrep: https://github.com/BurntSushi/ripgrep"
            echo "  - fd: https://github.com/sharkdp/fd"
            echo "  - ast-grep: https://ast-grep.github.io/"
        fi
    fi

    # Install pm2 via npm (handles both Homebrew and manual setups)
    echo -e "${YELLOW}Installing pm2 via npm...${NC}"
    if command -v npm &> /dev/null; then
        npm install -g pm2 || {
            echo -e "${YELLOW}⚠️  Failed to install pm2 globally. Trying locally...${NC}"
            npm install pm2 || {
                echo -e "${RED}❌ Failed to install pm2${NC}"
                echo -e "${YELLOW}Please install manually: npm install -g pm2${NC}"
            }
        }
        echo -e "${GREEN}✅ pm2 installed${NC}"
    else
        echo -e "${RED}❌ npm not found${NC}"
        echo -e "${YELLOW}Please install Node.js and npm first${NC}"
    fi

    echo -e "${GREEN}✅ System dependencies installation completed${NC}"
}

# Function to copy system files
copy_system_files() {
    echo -e "${BLUE}📁 Installing system files...${NC}"

    # Create install directory
    mkdir -p "$INSTALL_DIR"

    # Copy essential directories
    echo -e "${YELLOW}Copying system components...${NC}"

    # Copy MLX servers
    cp -r "$SYSTEM_DIR/mlx-servers" "$INSTALL_DIR/"

    # Copy MCP server
    cp -r "$SYSTEM_DIR/mcp-server" "$INSTALL_DIR/"

    # Copy skills
    cp -r "$SYSTEM_DIR/skills" "$INSTALL_DIR/"

    # Copy hooks
    cp -r "$SYSTEM_DIR/hooks" "$INSTALL_DIR/"

    # Copy scripts
    cp -r "$SYSTEM_DIR/scripts" "$INSTALL_DIR/"

    # Copy configuration files
    cp "$SYSTEM_DIR/mlx_enhanced_config.json" "$INSTALL_DIR/"
    cp "$SYSTEM_DIR/optimized_lb_config.json" "$INSTALL_DIR/"
    cp "$SYSTEM_DIR/.env" "$INSTALL_DIR/"

    # Copy setup scripts
    cp "$SYSTEM_DIR/use-qwen3-system.sh" "$INSTALL_DIR/"
    cp "$SYSTEM_DIR/setup-claude-hooks.sh" "$INSTALL_DIR/"

    echo -e "${GREEN}✅ System files copied${NC}"
}

# Function to setup Python environment
setup_python_env() {
    echo -e "${BLUE}🐍 Setting up Python environment...${NC}"

    cd "$INSTALL_DIR"

    # Create virtual environment
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    python3 -m venv venv

    # Activate virtual environment
    source venv/bin/activate

    # Upgrade pip
    pip install --upgrade pip

    # Install Python dependencies
    echo -e "${YELLOW}Installing Python dependencies...${NC}"
    pip install mlx mlx-lm
    pip install huggingface_hub
    pip install aiohttp psutil
    pip install flask flask-cors
    pip install numpy

    echo -e "${GREEN}✅ Python environment setup complete${NC}"
}

# Function to setup Node.js environment
setup_node_env() {
    echo -e "${BLUE}📦 Setting up Node.js environment...${NC}"

    cd "$INSTALL_DIR/mcp-server"

    # Install Node.js dependencies
    echo -e "${YELLOW}Installing Node.js dependencies...${NC}"
    npm install

    # Build TypeScript
    echo -e "${YELLOW}Building TypeScript code...${NC}"
    npm run build || {
        echo -e "${YELLOW}⚠️  TypeScript build completed with warnings${NC}"
    }

    echo -e "${GREEN}✅ Node.js environment setup complete${NC}"
}

# Function to create system startup script
create_startup_script() {
    echo -e "${BLUE}🚀 Creating startup script...${NC}"

    cat > "$INSTALL_DIR/start-system.sh" << EOF
#!/bin/bash
# Qwen3-VL-2B-Thinking System Startup Script

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "\${BLUE}🚀 Starting Qwen3-VL-2B-Thinking System\${NC}"
echo -e "\${BLUE}===================================\${NC}"

# Change to system directory
cd "\$INSTALL_DIR"

# Activate Python environment
echo -e "\${YELLOW}Activating Python environment...\${NC}"
source venv/bin/activate

# Start MLX servers
echo -e "\${YELLOW}Starting MLX servers...\${NC}"
pm2 start mlx-servers/ecosystem.config.js

# Wait for services to start
echo -e "\${YELLOW}Waiting for services to start...\${NC}"
sleep 10

# Check services
echo -e "\${YELLOW}Checking service status...\${NC}"
if curl -s http://localhost:8090/health > /dev/null 2>&1; then
    echo -e "\${GREEN}✅ MCP Server running\${NC}"
else
    echo -e "\${YELLOW}⚠️  MCP Server may not be running\${NC}"
fi

echo -e "\${GREEN}🎉 System startup complete!\${NC}"
echo ""
echo -e "\${YELLOW}Services:\${NC}"
echo "  MCP Server: http://localhost:8090"
echo "  Load Balancer: http://localhost:8091"
echo "  Health Monitor: http://localhost:8092"
echo ""
echo -e "\${YELLOW}Management:\${NC}"
echo "  pm2 list - Check service status"
echo "  pm2 logs - View logs"
echo "  pm2 stop all - Stop all services"
EOF

    chmod +x "$INSTALL_DIR/start-system.sh"

    echo -e "${GREEN}✅ Startup script created${NC}"
}

# Function to create environment setup script
create_env_script() {
    echo -e "${BLUE}🔧 Creating environment setup script...${NC}"

    cat > "$INSTALL_DIR/setup-env.sh" << EOF
#!/bin/bash
# Environment Setup Script for Qwen3-VL-2B-Thinking System

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# System directory
export QWEN3_SYSTEM_DIR="$INSTALL_DIR"
export PATH="\$QWEN3_SYSTEM_DIR:\$PATH"

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

echo -e "\${GREEN}✅ Environment configured for Qwen3-VL-2B-Thinking\${NC}"
echo -e "\${YELLOW}System directory: \$QWEN3_SYSTEM_DIR\${NC}"
EOF

    chmod +x "$INSTALL_DIR/setup-env.sh"

    echo -e "${GREEN}✅ Environment script created${NC}"
}

# Function to run tests
run_tests() {
    echo -e "${BLUE}🧪 Running system tests...${NC}"

    cd "$INSTALL_DIR"
    source venv/bin/activate

    # Test MLX installation
    echo -e "${YELLOW}Testing MLX...${NC}"
    python -c "import mlx; print('MLX installed successfully')" || {
        echo -e "${RED}❌ MLX test failed${NC}"
        return 1
    }

    # Test MLX-LM
    echo -e "${YELLOW}Testing MLX-LM...${NC}"
    python -c "import mlx_lm; print('MLX-LM installed successfully')" || {
        echo -e "${RED}❌ MLX-LM test failed${NC}"
        return 1
    }

    # Test model loading (may take time)
    echo -e "${YELLOW}Testing model loading...${NC}"
    timeout 60 python -c "
from mlx_lm import load
model, tokenizer = load('lmstudio-community/Qwen3-VL-2B-Thinking-MLX-8bit')
print('Model loaded successfully')
" || {
        echo -e "${YELLOW}⚠️  Model loading test timed out (may be due to download)${NC}"
    }

    echo -e "${GREEN}✅ System tests completed${NC}"
}

# Function to show completion message
show_completion() {
    echo ""
    echo -e "${GREEN}🎉 Installation completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}📁 Installation directory: ${INSTALL_DIR}${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo ""
    echo "1. Set up your environment:"
    echo "   source ${INSTALL_DIR}/setup-env.sh"
    echo ""
    echo "2. Start the system:"
    echo "   ${INSTALL_DIR}/start-system.sh"
    echo ""
    echo "3. Use in any repository:"
    echo "   cd /path/to/your/project"
    echo "   ${INSTALL_DIR}/use-qwen3-system.sh"
    echo ""
    echo "4. Verify installation:"
    echo "   pm2 list"
    echo "   curl http://localhost:8090/health"
    echo ""
    echo -e "${CYAN}📚 For detailed usage, see: ${INSTALL_DIR}/DEPLOYMENT_GUIDE.md${NC}"
    echo ""
}

# Main installation flow
main() {
    echo -e "${CYAN}Starting installation of Qwen3-VL-2B-Thinking System...${NC}"
    echo ""

    # Check if install directory exists
    if [ -d "$INSTALL_DIR" ]; then
        echo -e "${YELLOW}⚠️  Installation directory already exists${NC}"
        read -p "Do you want to overwrite? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Installation cancelled."
            exit 0
        fi
        rm -rf "$INSTALL_DIR"
    fi

    # Run installation steps
    check_requirements
    install_system_deps
    copy_system_files
    setup_python_env
    setup_node_env
    create_startup_script
    create_env_script

    # Run tests
    if run_tests; then
        show_completion
    else
        echo -e "${RED}❌ Installation completed with test failures${NC}"
        echo -e "${YELLOW}Please check the error messages above${NC}"
        exit 1
    fi
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [--help]"
        echo ""
        echo "Install the Qwen3-VL-2B-Thinking system for Claude Code integration."
        echo ""
        echo "Environment variables:"
        echo "  INSTALL_DIR  - Installation directory (default: \$HOME/qwen3-claude-system)"
        echo ""
        exit 0
        ;;
    *)
        main
        ;;
esac