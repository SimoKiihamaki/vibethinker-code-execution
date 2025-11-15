#!/bin/bash
# MCP Server Startup Wrapper
# Ensures MLX instances are running before starting the MCP server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Check if MLX instances are running
check_mlx_instances() {
    log_info "Checking MLX instances availability..."

    local healthy_count=0
    local total_count=27

    for port in {8080..8106}; do
        if curl -s -f "http://localhost:$port/health" > /dev/null 2>&1; then
            ((healthy_count++))
        fi
    done

    echo $healthy_count
}

# Start MLX system if needed
start_mlx_system() {
    log_info "Starting MLX system..."

    cd "$PROJECT_ROOT"

    # Check if enhanced_server_manager is already running
    if pgrep -f "enhanced_server_manager.py" > /dev/null; then
        log_info "Enhanced server manager already running"
    else
        log_info "Starting enhanced server manager..."
        python3 mlx-servers/enhanced_server_manager.py \
            --config mlx_enhanced_config.json \
            --port 8091 \
            >> logs/server-manager.log 2>&1 &

        # Wait for startup
        sleep 5
    fi

    # Check if optimized_load_balancer is running
    if pgrep -f "optimized_load_balancer.py" > /dev/null; then
        log_info "Load balancer already running"
    else
        log_info "Starting optimized load balancer..."
        python3 mlx-servers/optimized_load_balancer.py \
            --config optimized_lb_config.json \
            --port 8090 \
            >> logs/load-balancer.log 2>&1 &

        # Wait for startup
        sleep 3
    fi

    # Wait for instances to become healthy
    log_info "Waiting for MLX instances to become available..."
    local max_wait=30
    local waited=0

    while [ $waited -lt $max_wait ]; do
        local healthy=$(check_mlx_instances)
        if [ $healthy -gt 0 ]; then
            log_success "$healthy/27 MLX instances are healthy"
            return 0
        fi
        sleep 2
        ((waited+=2))
    done

    log_warn "No MLX instances became available after ${max_wait}s"
    log_warn "MCP server will start with degraded functionality"
    return 0
}

# Main startup sequence
main() {
    log_info "Starting VibeThinker MCP Server..."

    # Check if we're in the right directory
    if [ ! -f "$SCRIPT_DIR/package.json" ]; then
        log_error "Cannot find package.json in $SCRIPT_DIR"
        exit 1
    fi

    # Check for compiled server
    if [ ! -f "$SCRIPT_DIR/dist/index.js" ]; then
        log_info "Server not compiled, building..."
        cd "$SCRIPT_DIR"
        npm run build
    fi

    # Create logs directory if it doesn't exist
    mkdir -p "$PROJECT_ROOT/logs"

    # Check MLX availability
    local healthy=$(check_mlx_instances)

    if [ $healthy -eq 0 ]; then
        log_warn "No MLX instances detected (0/27 healthy)"

        # Ask if we should start them (but don't wait for input in non-interactive mode)
        if [ -t 0 ]; then
            read -p "Start MLX system now? (y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                start_mlx_system
            else
                log_warn "Proceeding without MLX instances"
                log_warn "Tools requiring MLX will be disabled"
            fi
        else
            # Non-interactive mode - try to start automatically
            start_mlx_system
        fi
    else
        log_success "$healthy/27 MLX instances are already healthy"
    fi

    # Start the MCP server
    log_info "Starting MCP server..."
    cd "$SCRIPT_DIR"

    # Run the server (this blocks)
    exec node dist/index.js
}

# Handle signals
trap 'log_warn "Received interrupt signal"; exit 130' INT TERM

# Run main
main
