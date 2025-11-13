const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Monitoring Dashboard Server
 * Provides real-time monitoring dashboard for the MLX-Powered Agentic RAG System
 */

class MonitoringDashboard {
  constructor(port = 8081) {
    this.app = express();
    this.port = port;
    this.metrics = {
      requests: [],
      responses: [],
      errors: [],
      performance: {}
    };
    
    this.setupMiddleware();
    this.setupRoutes();
    this.startMetricsCollection();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../public')));
  }

  setupRoutes() {
    // Dashboard home
    this.app.get('/', (req, res) => {
      res.send(this.generateDashboardHTML());
    });

    // Real-time metrics
    this.app.get('/api/metrics', (req, res) => {
      res.json({
        requests: this.metrics.requests.slice(-100),
        responses: this.metrics.responses.slice(-100),
        errors: this.metrics.errors.slice(-100),
        performance: this.metrics.performance
      });
    });

    // System overview
    this.app.get('/api/overview', async (req, res) => {
      try {
        const overview = await this.getSystemOverview();
        res.json(overview);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // MLX instances status
    this.app.get('/api/mlx-instances', async (req, res) => {
      try {
        const instances = await this.getMLXInstancesStatus();
        res.json(instances);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Performance trends
    this.app.get('/api/performance', (req, res) => {
      const trends = this.calculatePerformanceTrends();
      res.json(trends);
    });

    // Alert status
    this.app.get('/api/alerts', (req, res) => {
      const alerts = this.getActiveAlerts();
      res.json(alerts);
    });

    // Export metrics
    this.app.get('/api/export', (req, res) => {
      const format = req.query.format || 'json';
      const data = this.exportMetrics(format);
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=metrics.csv');
      } else {
        res.setHeader('Content-Type', 'application/json');
      }
      
      res.send(data);
    });
  }

  generateDashboardHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MLX-Powered Agentic RAG System - Monitoring Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f0f0f;
            color: #e0e0e0;
            line-height: 1.6;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 2rem;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }
        
        .header h1 {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            background: linear-gradient(45deg, #fff, #e0e0e0);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .dashboard {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            padding: 2rem;
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .card {
            background: #1a1a1a;
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            border: 1px solid #333;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .card:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 40px rgba(102, 126, 234, 0.2);
        }
        
        .card h3 {
            font-size: 1.3rem;
            margin-bottom: 1rem;
            color: #667eea;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 0;
            border-bottom: 1px solid #333;
        }
        
        .metric:last-child {
            border-bottom: none;
        }
        
        .metric-label {
            font-weight: 500;
            color: #b0b0b0;
        }
        
        .metric-value {
            font-weight: 700;
            font-size: 1.1rem;
        }
        
        .status {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.875rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .status.healthy {
            background: rgba(34, 197, 94, 0.2);
            color: #22c55e;
            border: 1px solid #22c55e;
        }
        
        .status.warning {
            background: rgba(251, 191, 36, 0.2);
            color: #fbbf24;
            border: 1px solid #fbbf24;
        }
        
        .status.critical {
            background: rgba(239, 68, 68, 0.2);
            color: #ef4444;
            border: 1px solid #ef4444;
        }
        
        .chart-container {
            position: relative;
            height: 300px;
            margin-top: 1rem;
        }
        
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-top: 1rem;
        }
        
        .progress-bar {
            background: #333;
            border-radius: 10px;
            height: 8px;
            overflow: hidden;
            margin-top: 0.5rem;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            border-radius: 10px;
            transition: width 0.3s ease;
        }
        
        .alert {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid #ef4444;
            border-radius: 8px;
            padding: 1rem;
            margin: 1rem 0;
            color: #ef4444;
        }
        
        .alert-title {
            font-weight: 700;
            margin-bottom: 0.5rem;
        }
        
        @media (max-width: 768px) {
            .dashboard {
                grid-template-columns: 1fr;
                padding: 1rem;
            }
            
            .header h1 {
                font-size: 2rem;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>MLX-Powered Agentic RAG System</h1>
        <p>Real-time Monitoring Dashboard</p>
    </div>
    
    <div class="dashboard">
        <div class="card">
            <h3>🚀 System Overview</h3>
            <div id="overview-metrics"></div>
        </div>
        
        <div class="card">
            <h3>📊 Performance Metrics</h3>
            <div id="performance-chart" class="chart-container">
                <canvas id="performanceCanvas"></canvas>
            </div>
        </div>
        
        <div class="card">
            <h3>🔧 MLX Instances</h3>
            <div id="mlx-status"></div>
        </div>
        
        <div class="card">
            <h3>⚡ Token Efficiency</h3>
            <div id="token-efficiency"></div>
        </div>
        
        <div class="card">
            <h3>📈 Request Trends</h3>
            <div id="request-chart" class="chart-container">
                <canvas id="requestCanvas"></canvas>
            </div>
        </div>
        
        <div class="card">
            <h3>🚨 Active Alerts</h3>
            <div id="alerts"></div>
        </div>
    </div>
    
    <script>
        // Dashboard JavaScript
        let performanceChart, requestChart;
        let metrics = {};
        
        async function fetchMetrics() {
            try {
                const response = await fetch('/api/metrics');
                return await response.json();
            } catch (error) {
                console.error('Failed to fetch metrics:', error);
                return null;
            }
        }
        
        async function fetchOverview() {
            try {
                const response = await fetch('/api/overview');
                return await response.json();
            } catch (error) {
                console.error('Failed to fetch overview:', error);
                return null;
            }
        }
        
        async function fetchMLXStatus() {
            try {
                const response = await fetch('/api/mlx-instances');
                return await response.json();
            } catch (error) {
                console.error('Failed to fetch MLX status:', error);
                return null;
            }
        }
        
        async function fetchAlerts() {
            try {
                const response = await fetch('/api/alerts');
                return await response.json();
            } catch (error) {
                console.error('Failed to fetch alerts:', error);
                return null;
            }
        }
        
        function updateOverviewMetrics(overview) {
            const container = document.getElementById('overview-metrics');
            if (!overview) {
                container.innerHTML = '<div class="alert"><div class="alert-title">Connection Error</div>Unable to fetch system overview</div>';
                return;
            }
            
            container.innerHTML = \`
                <div class="metric">
                    <span class="metric-label">Overall Health</span>
                    <span class="metric-value">
                        <span class="status \${overview.overall.status}">\${overview.overall.status}</span>
                    </span>
                </div>
                <div class="metric">
                    <span class="metric-label">Health Score</span>
                    <span class="metric-value">\${overview.overall.score.toFixed(1)}%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">MLX Instances</span>
                    <span class="metric-value">\${overview.components.mlxServers.summary.healthy}/\${overview.components.mlxServers.summary.total}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">MCP Server</span>
                    <span class="metric-value">
                        <span class="status \${overview.components.mcpServer.status}">\${overview.components.mcpServer.status}</span>
                    </span>
                </div>
                <div class="metric">
                    <span class="metric-label">System Status</span>
                    <span class="metric-value">
                        <span class="status \${overview.components.system.status}">\${overview.components.system.status}</span>
                    </span>
                </div>
            \`;
        }
        
        function updateTokenEfficiency(metrics) {
            const container = document.getElementById('token-efficiency');
            if (!metrics) {
                container.innerHTML = '<div class="alert"><div class="alert-title">Connection Error</div>Unable to fetch metrics</div>';
                return;
            }
            
            container.innerHTML = \`
                <div class="metric">
                    <span class="metric-label">Token Reduction</span>
                    <span class="metric-value">\${metrics.performance.tokenReduction}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: \${metrics.performance.tokenReduction}%"></div>
                </div>
                
                <div class="metric">
                    <span class="metric-label">Processing Speed</span>
                    <span class="metric-value">\${metrics.performance.tokensPerSecond} tokens/sec</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: \${Math.min(100, metrics.performance.tokensPerSecond / 20)}%"></div>
                </div>
                
                <div class="metric">
                    <span class="metric-label">Avg Response Time</span>
                    <span class="metric-value">\${metrics.performance.averageResponseTime}s</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: \${Math.max(0, 100 - metrics.performance.averageResponseTime * 10)}%"></div>
                </div>
            \`;
        }
        
        function updateMLXStatus(mlxStatus) {
            const container = document.getElementById('mlx-status');
            if (!mlxStatus) {
                container.innerHTML = '<div class="alert"><div class="alert-title">Connection Error</div>Unable to fetch MLX status</div>';
                return;
            }
            
            const healthyCount = mlxStatus.summary.healthy;
            const totalCount = mlxStatus.summary.total;
            const healthPercentage = (healthyCount / totalCount * 100).toFixed(1);
            
            container.innerHTML = \`
                <div class="metric">
                    <span class="metric-label">Healthy Instances</span>
                    <span class="metric-value">\${healthyCount}/\${totalCount}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: \${healthPercentage}%"></div>
                </div>
                
                <div class="metric">
                    <span class="metric-label">Load Balancer</span>
                    <span class="metric-value">
                        <span class="status \${mlxStatus.loadBalancer.status}">\${mlxStatus.loadBalancer.status}</span>
                    </span>
                </div>
                
                <div class="metric">
                    <span class="metric-label">Avg Response Time</span>
                    <span class="metric-value">\${mlxStatus.loadBalancer.responseTime}ms</span>
                </div>
            \`;
        }
        
        function updateAlerts(alerts) {
            const container = document.getElementById('alerts');
            if (!alerts || alerts.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #22c55e;">✅ No active alerts</div>';
                return;
            }
            
            container.innerHTML = alerts.map(alert => \`
                <div class="alert">
                    <div class="alert-title">\${alert.title}</div>
                    <div>\${alert.message}</div>
                    <small>\${new Date(alert.timestamp).toLocaleString()}</small>
                </div>
            \`).join('');
        }
        
        function updatePerformanceChart(metrics) {
            if (!metrics) return;
            
            const ctx = document.getElementById('performanceCanvas').getContext('2d');
            
            if (performanceChart) {
                performanceChart.destroy();
            }
            
            performanceChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: metrics.responses.map((_, i) => i),
                    datasets: [{
                        label: 'Response Time (ms)',
                        data: metrics.responses.map(r => r.responseTime),
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4
                    }, {
                        label: 'Token Processing',
                        data: metrics.responses.map(r => r.tokensProcessed),
                        borderColor: '#764ba2',
                        backgroundColor: 'rgba(118, 75, 162, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#e0e0e0'
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                color: '#b0b0b0'
                            },
                            grid: {
                                color: '#333'
                            }
                        },
                        y: {
                            ticks: {
                                color: '#b0b0b0'
                            },
                            grid: {
                                color: '#333'
                            }
                        }
                    }
                }
            });
        }
        
        function updateRequestChart(metrics) {
            if (!metrics) return;
            
            const ctx = document.getElementById('requestCanvas').getContext('2d');
            
            if (requestChart) {
                requestChart.destroy();
            }
            
            requestChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: metrics.requests.map((_, i) => i),
                    datasets: [{
                        label: 'Requests',
                        data: metrics.requests.map(r => r.count),
                        backgroundColor: 'rgba(102, 126, 234, 0.8)',
                        borderColor: '#667eea',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#e0e0e0'
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                color: '#b0b0b0'
                            },
                            grid: {
                                color: '#333'
                            }
                        },
                        y: {
                            ticks: {
                                color: '#b0b0b0'
                            },
                            grid: {
                                color: '#333'
                            }
                        }
                    }
                }
            });
        }
        
        async function updateDashboard() {
            const [overview, metrics, mlxStatus, alerts] = await Promise.all([
                fetchOverview(),
                fetchMetrics(),
                fetchMLXStatus(),
                fetchAlerts()
            ]);
            
            updateOverviewMetrics(overview);
            updateTokenEfficiency(metrics);
            updateMLXStatus(mlxStatus);
            updateAlerts(alerts);
            updatePerformanceChart(metrics);
            updateRequestChart(metrics);
        }
        
        // Initialize dashboard
        updateDashboard();
        
        // Update every 5 seconds
        setInterval(updateDashboard, 5000);
    </script>
</body>
</html>
    `;
  }

  async getSystemOverview() {
    // Fetch health status from health server
    try {
      const healthResponse = await fetch('http://localhost:8080/health/status');
      const healthData = await healthResponse.json();
      
      return {
        overall: healthData.overall,
        components: healthData.components,
        metrics: healthData.metrics,
        timestamp: healthData.timestamp
      };
    } catch (error) {
      console.error('Failed to fetch system overview:', error);
      return null;
    }
  }

  async getMLXInstancesStatus() {
    try {
      const mlxResponse = await fetch('http://localhost:8080/health/mlx-servers');
      const mlxData = await mlxResponse.json();
      
      return mlxData;
    } catch (error) {
      console.error('Failed to fetch MLX instances status:', error);
      return null;
    }
  }

  calculatePerformanceTrends() {
    const now = Date.now();
    const trends = {
      requests: [],
      responseTime: [],
      tokenReduction: [],
      timestamps: []
    };

    // Generate sample data for the last 24 hours
    for (let i = 23; i >= 0; i--) {
      const timestamp = now - (i * 60 * 60 * 1000);
      trends.timestamps.push(new Date(timestamp).toLocaleTimeString());
      trends.requests.push(Math.floor(Math.random() * 1000) + 500);
      trends.responseTime.push(Math.random() * 10 + 5);
      trends.tokenReduction.push(98.7 + (Math.random() - 0.5) * 2);
    }

    return trends;
  }

  getActiveAlerts() {
    // Generate sample alerts based on system health
    const alerts = [];
    
    // Simulate some alerts
    if (Math.random() < 0.1) {
      alerts.push({
        id: 1,
        title: 'High Response Time',
        message: 'Average response time exceeded 15 seconds',
        severity: 'warning',
        timestamp: new Date().toISOString()
      });
    }
    
    if (Math.random() < 0.05) {
      alerts.push({
        id: 2,
        title: 'MLX Instance Down',
        message: 'MLX server instance 15 is not responding',
        severity: 'critical',
        timestamp: new Date().toISOString()
      });
    }

    return alerts;
  }

  exportMetrics(format) {
    if (format === 'csv') {
      return this.exportToCSV();
    } else {
      return JSON.stringify(this.metrics, null, 2);
    }
  }

  exportToCSV() {
    const headers = ['timestamp', 'request_count', 'response_time', 'tokens_processed', 'error_count'];
    const rows = [headers.join(',')];
    
    // Combine metrics into CSV format
    for (let i = 0; i < this.metrics.requests.length; i++) {
      const row = [
        this.metrics.requests[i]?.timestamp || '',
        this.metrics.requests[i]?.count || 0,
        this.metrics.responses[i]?.responseTime || 0,
        this.metrics.responses[i]?.tokensProcessed || 0,
        this.metrics.errors[i]?.count || 0
      ];
      rows.push(row.join(','));
    }
    
    return rows.join('\n');
  }

  startMetricsCollection() {
    // Simulate metrics collection every 5 seconds
    setInterval(() => {
      const now = new Date().toISOString();
      
      // Generate sample metrics
      this.metrics.requests.push({
        timestamp: now,
        count: Math.floor(Math.random() * 100) + 50
      });
      
      this.metrics.responses.push({
        timestamp: now,
        responseTime: Math.random() * 15 + 5,
        tokensProcessed: Math.floor(Math.random() * 2000) + 500
      });
      
      this.metrics.errors.push({
        timestamp: now,
        count: Math.random() < 0.05 ? 1 : 0,
        type: Math.random() < 0.5 ? 'timeout' : 'network'
      });
      
      // Keep only last 1000 entries
      if (this.metrics.requests.length > 1000) {
        this.metrics.requests.shift();
      }
      if (this.metrics.responses.length > 1000) {
        this.metrics.responses.shift();
      }
      if (this.metrics.errors.length > 1000) {
        this.metrics.errors.shift();
      }
      
      // Update performance metrics
      this.metrics.performance = {
        averageResponseTime: this.calculateAverageResponseTime(),
        averageTokensPerSecond: this.calculateAverageTokensPerSecond(),
        errorRate: this.calculateErrorRate(),
        throughput: this.calculateThroughput()
      };
    }, 5000);
  }

  calculateAverageResponseTime() {
    if (this.metrics.responses.length === 0) return 0;
    const sum = this.metrics.responses.reduce((acc, r) => acc + r.responseTime, 0);
    return sum / this.metrics.responses.length;
  }

  calculateAverageTokensPerSecond() {
    if (this.metrics.responses.length === 0) return 0;
    const sum = this.metrics.responses.reduce((acc, r) => acc + r.tokensProcessed, 0);
    return sum / this.metrics.responses.length;
  }

  calculateErrorRate() {
    if (this.metrics.errors.length === 0) return 0;
    const errorCount = this.metrics.errors.reduce((acc, e) => acc + e.count, 0);
    return (errorCount / this.metrics.errors.length) * 100;
  }

  calculateThroughput() {
    if (this.metrics.requests.length === 0) return 0;
    const recentRequests = this.metrics.requests.slice(-10);
    const sum = recentRequests.reduce((acc, r) => acc + r.count, 0);
    return sum / recentRequests.length;
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`Monitoring dashboard running on port ${this.port}`);
      console.log(`Dashboard: http://localhost:${this.port}`);
      console.log(`API: http://localhost:${this.port}/api/metrics`);
    });
  }
}

// Start the dashboard
const port = process.env.MONITORING_DASHBOARD_PORT || 8081;
const dashboard = new MonitoringDashboard(port);
dashboard.start();