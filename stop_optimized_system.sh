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
