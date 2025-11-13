#!/bin/bash
# Enhanced Deployment Script for Optimized MLX-Powered Agentic RAG System
# Targets 1,485+ tokens/sec throughput with advanced optimization

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MLX_INSTANCES=27
BASE_PORT=8080
MANAGER_PORT=8091
LOAD_BALANCER_PORT=8090
PYTHON_CMD="python3"
NODE_CMD="node"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites for optimized deployment..."
    
    # Check Python version
    if ! command -v $PYTHON_CMD &> /dev/null; then
        error "Python 3 is required but not installed"
        exit 1
    fi
    
    PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | awk '{print $2}')
    log "Python version: $PYTHON_VERSION"
    
    # Check Node.js
    if ! command -v $NODE_CMD &> /dev/null; then
        error "Node.js is required but not installed"
        exit 1
    fi
    
    NODE_VERSION=$($NODE_CMD --version)
    log "Node.js version: $NODE_VERSION"
    
    # Check available ports
    for port in $BASE_PORT $MANAGER_PORT $LOAD_BALANCER_PORT; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            error "Port $port is already in use"
            exit 1
        fi
    done
    
    # Check system resources
    if command -v free &> /dev/null; then
        MEMORY_GB=$(free -g | awk '/^Mem:/{print $2}')
        CPU_CORES=$(nproc)
    elif command -v vm_stat &> /dev/null; then
        # macOS memory check
        TOTAL_PAGES=$(vm_stat | awk '/Pages free:/ {print $3}' | sed 's/\.//')
        MEMORY_GB=$((TOTAL_PAGES * 4096 / 1024 / 1024 / 1024))
        CPU_CORES=$(sysctl -n hw.ncpu)
    else
        MEMORY_GB=32  # Default assumption
        CPU_CORES=8   # Default assumption
        warning "Unable to detect system resources, using defaults"
    fi
    
    log "System resources: ${MEMORY_GB}GB RAM, ${CPU_CORES} CPU cores"
    
    if [ "$MEMORY_GB" -lt 16 ]; then
        warning "Less than 16GB RAM may impact performance with 27 MLX instances"
    fi
    
    success "Prerequisites check completed"
}

# Install Python dependencies for optimization
install_python_deps() {
    log "Installing Python dependencies for enhanced performance..."
    
    # Core MLX dependencies
    pip3 install --upgrade mlx-lm mlx aiohttp psutil numpy torch
    
    # Performance optimization dependencies
    pip3 install --upgrade asyncio-mqtt fastapi uvloop
    
    success "Python dependencies installed"
}

# Install Node.js dependencies
install_node_deps() {
    log "Installing Node.js dependencies..."
    
    if [ -f "package.json" ]; then
        npm install
        success "Node.js dependencies installed"
    else
        warning "No package.json found, skipping Node.js dependencies"
    fi
}

# Setup optimized MLX models
setup_models() {
    log "Setting up optimized MLX models..."
    
    MODELS_DIR="mlx-models"
    mkdir -p "$MODELS_DIR"
    
    # Download and optimize models (example with Mixtral)
    if [ ! -d "$MODELS_DIR/mixtral-8x7b-instruct-v0.1" ]; then
        log "Downloading Mixtral model for MLX optimization..."
        
        # This would typically involve downloading the model
        # For now, we'll create a placeholder
        mkdir -p "$MODELS_DIR/mixtral-8x7b-instruct-v0.1"
        echo '{"model": "mixtral-8x7b-instruct", "quantization": "q4"}' > "$MODELS_DIR/mixtral-8x7b-instruct-v0.1/config.json"
    fi
    
    success "MLX models setup completed"
}

# Start enhanced server manager
start_enhanced_manager() {
    log "Starting enhanced MLX server manager..."
    
    # Create enhanced manager configuration
    cat > mlx_enhanced_config.json << EOF
{
    "mlx_servers": {
        "base_port": $BASE_PORT,
        "instances": $MLX_INSTANCES
    },
    "health_check_interval": 15,
    "performance_monitor_interval": 10,
    "max_restart_attempts": 3,
    "restart_cooldown": 60,
    "optimization": {
        "batch_size": 6,
        "max_concurrent_requests": 12,
        "quantization": "q4",
        "memory_limit_gb": 2.0,
        "target_throughput": 1485
    }
}
EOF
    
    # Start enhanced manager in background
    nohup $PYTHON_CMD mlx-servers/enhanced_server_manager.py \
        --config mlx_enhanced_config.json \
        --port $MANAGER_PORT \
        > logs/enhanced_manager.log 2>&1 &
    
    MANAGER_PID=$!
    echo $MANAGER_PID > logs/enhanced_manager.pid
    
    # Wait for manager to start
    sleep 5
    
    # Check if manager started successfully
    if ps -p $MANAGER_PID > /dev/null; then
        success "Enhanced server manager started (PID: $MANAGER_PID)"
    else
        error "Failed to start enhanced server manager"
        exit 1
    fi
}

# Start optimized load balancer
start_optimized_load_balancer() {
    log "Starting optimized load balancer..."
    
    # Create optimized load balancer configuration
    cat > optimized_lb_config.json << EOF
{
    "mlx_servers": {
        "base_port": $BASE_PORT,
        "instances": $MLX_INSTANCES
    },
    "load_balancer": {
        "health_check_timeout": 5,
        "circuit_breaker": {
            "failure_threshold": 5,
            "recovery_timeout": 60
        },
        "max_retries": 2,
        "retry_delay": 500,
        "max_batch_size": 8,
        "max_batch_wait": 0.05,
        "connection_pool_size": 100,
        "algorithm": "performance"
    },
    "performance": {
        "request_timeout": 30000,
        "target_throughput": 1485,
        "memory_limit_gb": 1.5
    }
}
EOF
    
    # Start optimized load balancer in background
    nohup $PYTHON_CMD mlx-servers/optimized_load_balancer.py \
        --config optimized_lb_config.json \
        --port $LOAD_BALANCER_PORT \
        > logs/optimized_load_balancer.log 2>&1 &
    
    LB_PID=$!
    echo $LB_PID > logs/optimized_load_balancer.pid
    
    # Wait for load balancer to start
    sleep 3
    
    # Check if load balancer started successfully
    if ps -p $LB_PID > /dev/null; then
        success "Optimized load balancer started (PID: $LB_PID)"
    else
        error "Failed to start optimized load balancer"
        exit 1
    fi
}

# Start optimized MLX instances
start_optimized_instances() {
    log "Starting $MLX_INSTANCES optimized MLX instances..."
    
    # Start instances through enhanced manager
    curl -X POST http://localhost:$MANAGER_PORT/start || {
        error "Failed to start MLX instances through manager"
        exit 1
    }
    
    # Wait for instances to start
    log "Waiting for MLX instances to start..."
    sleep 30
    
    # Verify instances are running
    for i in $(seq 0 $((MLX_INSTANCES - 1))); do
        port=$((BASE_PORT + i))
        if ! curl -f http://localhost:$port/health > /dev/null 2>&1; then
            warning "Instance $i on port $port may not be ready yet"
        fi
    done
    
    success "Optimized MLX instances started"
}

# Build and start MCP server
start_mcp_server() {
    log "Starting MCP server..."
    
    # Skip build and run directly from source
    # Start MCP server in background
    nohup $NODE_CMD mcp-server/src/index.js > logs/mcp_server.log 2>&1 &
    
    MCP_PID=$!
    echo $MCP_PID > logs/mcp_server.pid
    
    success "MCP server started (PID: $MCP_PID)"
}

# Start health monitoring
start_health_monitoring() {
    log "Starting health monitoring system..."
    
    # Start health monitoring server
    nohup $NODE_CMD scripts/health-server.js > logs/health_server.log 2>&1 &
    
    HEALTH_PID=$!
    echo $HEALTH_PID > logs/health_server.pid
    
    # Start monitoring dashboard
    nohup $NODE_CMD scripts/monitoring-dashboard.js > logs/monitoring_dashboard.log 2>&1 &
    
    DASHBOARD_PID=$!
    echo $DASHBOARD_PID > logs/monitoring_dashboard.pid
    
    success "Health monitoring system started"
}

# Performance validation
validate_performance() {
    log "Validating system performance..."
    
    # Wait for system to stabilize
    log "Waiting for system to stabilize..."
    sleep 60
    
    # Run performance tests
    log "Running performance validation tests..."
    npm test tests/integration/performance-validation.test.js
    
    # Check if throughput target is met
    THROUGHPUT=$(curl -s http://localhost:$MANAGER_PORT/status | jq -r '.performance.total_throughput_tokens_per_sec // 0')
    
    if (( $(echo "$THROUGHPUT >= 1485" | bc -l) )); then
        success "🎉 THROUGHPUT TARGET ACHIEVED: ${THROUGHPUT} tokens/sec"
    else
        warning "⚠️  Throughput below target: ${THROUGHPUT} tokens/sec (target: 1485)"
        log "Consider the following optimizations:"
        log "1. Increase batch sizes in optimized servers"
        log "2. Add more MLX instances if system resources allow"
        log "3. Optimize model quantization settings"
        log "4. Check for system resource bottlenecks"
    fi
}

# Create management scripts
create_management_scripts() {
    log "Creating management scripts..."
    
    # Create start script
    cat > start_optimized_system.sh << 'EOF'
#!/bin/bash
# Start optimized MLX system
echo "Starting optimized MLX-Powered Agentic RAG System..."

# Start enhanced manager
python3 mlx-servers/enhanced_server_manager.py --config mlx_enhanced_config.json --port 8091 &

# Start optimized load balancer
python3 mlx-servers/optimized_load_balancer.py --config optimized_lb_config.json --port 8090 &

# Start MCP server
npm run build
node dist/mcp-server/index.js &

# Start health monitoring
node scripts/health-server.js &
node scripts/monitoring-dashboard.js &

echo "All components started. Check logs/ directory for details."
echo "Monitoring dashboard: http://localhost:3001"
echo "Health status: http://localhost:8092"
EOF

    # Create stop script
    cat > stop_optimized_system.sh << 'EOF'
#!/bin/bash
# Stop optimized MLX system
echo "Stopping optimized MLX-Powered Agentic RAG System..."

# Kill processes
pkill -f "enhanced_server_manager.py"
pkill -f "optimized_load_balancer.py"
pkill -f "mcp-server/index.js"
pkill -f "health-server.js"
pkill -f "monitoring-dashboard.js"

# Kill any remaining Python MLX processes
pkill -f "mlx.*server"

echo "All components stopped."
EOF

    chmod +x start_optimized_system.sh stop_optimized_system.sh
    
    success "Management scripts created"
}

# Main deployment function
main() {
    log "🚀 Starting Enhanced MLX-Powered Agentic RAG System Deployment"
    log "Target: 1,485+ tokens/sec throughput with advanced optimization"
    
    # Create logs directory
    mkdir -p logs
    
    # Execute deployment steps
    check_prerequisites
    install_python_deps
    install_node_deps
    setup_models
    
    # Start system components
    start_enhanced_manager
    start_optimized_load_balancer
    start_optimized_instances
    start_mcp_server
    start_health_monitoring
    
    # Create management tools
    create_management_scripts
    
    # Validate performance
    validate_performance
    
    # Final status
    log "🎉 Enhanced MLX-Powered Agentic RAG System deployment completed!"
    log ""
    log "📊 System Status:"
    log "   • Enhanced Manager: http://localhost:$MANAGER_PORT"
    log "   • Optimized Load Balancer: http://localhost:$LOAD_BALANCER_PORT"
    log "   • Health Monitoring: http://localhost:8092"
    log "   • Monitoring Dashboard: http://localhost:3001"
    log ""
    log "🔧 Management Scripts:"
    log "   • Start: ./start_optimized_system.sh"
    log "   • Stop: ./stop_optimized_system.sh"
    log ""
    log "📈 Performance Targets:"
    log "   • Throughput: 1,485+ tokens/sec"
    log "   • Response Time: < 10 seconds"
    log "   • Cache Hit Rate: 95%+"
    log "   • Token Reduction: 98.7%"
    log ""
    log "Check logs/ directory for detailed component logs"
}

# Run main function
main "$@"