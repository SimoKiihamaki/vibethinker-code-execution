#!/usr/bin/env python3
"""
MLX Server Manager for VibeThinker
Manages 27 MLX server instances with process monitoring
"""

import asyncio
import json
import logging
import subprocess
import signal
import sys
import time
import os
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import psutil
import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class MLXServerProcess:
    """Represents a managed MLX server process"""
    id: int
    port: int
    process: Optional[subprocess.Popen] = None
    pid: Optional[int] = None
    healthy: bool = False
    start_time: Optional[float] = None
    restart_count: int = 0

class MLXServerManager:
    """Manages multiple MLX server processes"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.processes: List[MLXServerProcess] = []
        self.running = False
        self.health_check_task: Optional[asyncio.Task] = None
        
        # Setup signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        logger.info(f"Received signal {signum}, shutting down...")
        self.running = False
        if self.health_check_task:
            self.health_check_task.cancel()
    
    def _create_mlx_command(self, instance: MLXServerProcess) -> List[str]:
        """Create command to start MLX server instance"""
        mlx_config = self.config['mlx_servers']
        
        cmd = [
            'python3', '-m', 'mlx_lm.server',
            '--model', mlx_config['model_path'],
            '--port', str(instance.port),
            '--host', '0.0.0.0',
            '--max-tokens', str(mlx_config['max_tokens']),
            '--temperature', str(mlx_config['temperature']),
            '--top-p', str(mlx_config['top_p']),
        ]
        
        # Add quantization if specified
        if mlx_config.get('quantization'):
            cmd.extend(['--quantization', mlx_config['quantization']])
        
        # Add batch size if specified
        if mlx_config.get('batch_size'):
            cmd.extend(['--batch-size', str(mlx_config['batch_size'])])
        
        return cmd
    
    def _start_instance(self, instance: MLXServerProcess) -> bool:
        """Start a single MLX server instance"""
        try:
            logger.info(f"Starting MLX instance {instance.id} on port {instance.port}")
            
            cmd = self._create_mlx_command(instance)
            
            # Set environment variables
            env = os.environ.copy()
            env['MLX_GPU_MEMORY_FRACTION'] = str(self.config['mlx_servers'].get('gpu_memory_fraction', 0.8))
            
            # Start the process
            instance.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env,
                text=True
            )
            
            instance.pid = instance.process.pid
            instance.start_time = time.time()
            instance.restart_count += 1
            
            logger.info(f"Started MLX instance {instance.id} with PID {instance.pid}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start MLX instance {instance.id}: {e}")
            return False
    
    def _stop_instance(self, instance: MLXServerProcess) -> bool:
        """Stop a single MLX server instance"""
        try:
            if instance.process and instance.process.poll() is None:
                logger.info(f"Stopping MLX instance {instance.id} (PID {instance.pid})")
                
                # Try graceful shutdown first
                instance.process.terminate()
                
                # Wait for graceful shutdown
                try:
                    instance.process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    logger.warning(f"Force killing MLX instance {instance.id}")
                    instance.process.kill()
                    instance.process.wait()
                
                instance.process = None
                instance.pid = None
                instance.healthy = False
                
                logger.info(f"Stopped MLX instance {instance.id}")
                return True
            else:
                logger.info(f"MLX instance {instance.id} is already stopped")
                return True
                
        except Exception as e:
            logger.error(f"Failed to stop MLX instance {instance.id}: {e}")
            return False
    
    async def _health_check_instance(self, instance: MLXServerProcess) -> bool:
        """Perform health check on MLX instance"""
        try:
            # Check if process is running
            if not instance.process or instance.process.poll() is not None:
                logger.warning(f"MLX instance {instance.id} process is not running")
                return False
            
            # Check if port is responsive
            url = f"http://localhost:{instance.port}/health"
            timeout = self.config['load_balancer']['health_check_timeout']
            
            response = requests.get(url, timeout=timeout)
            
            if response.status_code == 200:
                instance.healthy = True
                return True
            else:
                logger.warning(f"MLX instance {instance.id} health check failed: {response.status_code}")
                instance.healthy = False
                return False
                
        except requests.exceptions.RequestException as e:
            logger.warning(f"MLX instance {instance.id} health check failed: {e}")
            instance.healthy = False
            return False
        except Exception as e:
            logger.error(f"Unexpected error in health check for instance {instance.id}: {e}")
            instance.healthy = False
            return False
    
    async def _health_check_loop(self):
        """Health check loop for all instances"""
        interval = self.config['load_balancer']['health_check_interval']
        
        logger.info(f"Starting health check loop with {interval}s interval")
        
        while self.running:
            try:
                healthy_count = 0
                
                for instance in self.processes:
                    healthy = await self._health_check_instance(instance)
                    if healthy:
                        healthy_count += 1
                    else:
                        # Restart unhealthy instance
                        logger.warning(f"Restarting unhealthy MLX instance {instance.id}")
                        self._stop_instance(instance)
                        await asyncio.sleep(2)  # Wait before restart
                        self._start_instance(instance)
                
                logger.info(f"Health check: {healthy_count}/{len(self.processes)} instances healthy")
                
                # Wait for next health check
                await asyncio.sleep(interval)
                
            except asyncio.CancelledError:
                logger.info("Health check loop cancelled")
                break
            except Exception as e:
                logger.error(f"Health check loop error: {e}")
                await asyncio.sleep(interval)
    
    def _initialize_instances(self):
        """Initialize MLX server instances"""
        mlx_config = self.config['mlx_servers']
        base_port = mlx_config['base_port']
        num_instances = mlx_config['instances']
        
        for i in range(num_instances):
            instance = MLXServerProcess(
                id=i,
                port=base_port + i
            )
            self.processes.append(instance)
        
        logger.info(f"Initialized {num_instances} MLX server instances")
    
    async def start_all(self) -> bool:
        """Start all MLX server instances"""
        logger.info("Starting all MLX server instances...")
        
        self.running = True
        
        # Start instances with staggered delays to avoid overwhelming the system
        for i, instance in enumerate(self.processes):
            success = self._start_instance(instance)
            if not success:
                logger.error(f"Failed to start MLX instance {instance.id}")
                return False
            
            # Stagger starts to avoid overwhelming GPU
            if i < len(self.processes) - 1:
                await asyncio.sleep(2)
        
        # Wait for instances to start up
        logger.info("Waiting for MLX instances to initialize...")
        await asyncio.sleep(10)
        
        # Start health check loop
        self.health_check_task = asyncio.create_task(self._health_check_loop())
        
        logger.info("All MLX server instances started successfully")
        return True
    
    async def stop_all(self):
        """Stop all MLX server instances"""
        logger.info("Stopping all MLX server instances...")
        
        self.running = False
        
        # Cancel health check task
        if self.health_check_task:
            self.health_check_task.cancel()
            try:
                await self.health_check_task
            except asyncio.CancelledError:
                pass
        
        # Stop all instances
        for instance in self.processes:
            self._stop_instance(instance)
        
        logger.info("All MLX server instances stopped")
    
    def get_status(self) -> Dict[str, Any]:
        """Get status of all instances"""
        status = {
            'running': self.running,
            'total_instances': len(self.processes),
            'healthy_instances': sum(1 for inst in self.processes if inst.healthy),
            'instances': []
        }
        
        for instance in self.processes:
            instance_status = {
                'id': instance.id,
                'port': instance.port,
                'pid': instance.pid,
                'healthy': instance.healthy,
                'start_time': instance.start_time,
                'uptime': time.time() - instance.start_time if instance.start_time else 0,
                'restart_count': instance.restart_count,
            }
            status['instances'].append(instance_status)
        
        return status
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get performance metrics"""
        metrics = {
            'total_instances': len(self.processes),
            'healthy_instances': sum(1 for inst in self.processes if inst.healthy),
            'total_restarts': sum(inst.restart_count for inst in self.processes),
            'avg_uptime': statistics.mean([
                time.time() - inst.start_time for inst in self.processes 
                if inst.start_time
            ]) if any(inst.start_time for inst in self.processes) else 0,
        }
        
        return metrics

async def main():
    """Main function"""
    # Load configuration
    config_path = 'mlx-servers/config.json'
    
    if not os.path.exists(config_path):
        logger.error(f"Configuration file not found: {config_path}")
        sys.exit(1)
    
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    # Create server manager
    manager = MLXServerManager(config)
    
    try:
        # Start all instances
        success = await manager.start_all()
        if not success:
            logger.error("Failed to start MLX server instances")
            sys.exit(1)
        
        # Keep running until interrupted
        logger.info("MLX server manager is running. Press Ctrl+C to stop.")
        
        while True:
            await asyncio.sleep(1)
            
            # Print status periodically
            if int(time.time()) % 60 == 0:
                status = manager.get_status()
                logger.info(f"Status: {status['healthy_instances']}/{status['total_instances']} instances healthy")
    
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    
    finally:
        # Stop all instances
        await manager.stop_all()
        logger.info("Shutdown complete")

if __name__ == '__main__':
    asyncio.run(main())