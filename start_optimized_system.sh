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
