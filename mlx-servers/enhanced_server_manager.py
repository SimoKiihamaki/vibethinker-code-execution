#!/usr/bin/env python3
"""
Enhanced MLX Server Manager for Optimized Performance
Manages 27 optimized MLX instances with advanced monitoring
"""

import asyncio
import json
import logging
import time
import subprocess
import signal
import sys
import os
import argparse
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from pathlib import Path
import psutil
import aiohttp
from aiohttp import web
import threading
import statistics
from concurrent.futures import ThreadPoolExecutor
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@dataclass
class OptimizedServerInstance:
    """Enhanced server instance tracking"""

    id: int
    port: int
    pid: Optional[int] = None
    process: Optional[subprocess.Popen] = None
    status: str = "stopped"  # stopped, starting, running, failed
    start_time: Optional[float] = None
    last_heartbeat: Optional[float] = None
    metrics: Dict[str, Any] = None
    restart_count: int = 0
    performance_score: float = 0.0

    def __post_init__(self):
        if self.metrics is None:
            self.metrics = {
                "requests_processed": 0,
                "tokens_processed": 0,
                "average_response_time": 0.0,
                "throughput_tokens_per_sec": 0.0,
                "memory_usage_mb": 0.0,
                "cpu_usage_percent": 0.0,
                "error_count": 0,
                "last_updated": time.time(),
            }

    def update_performance_score(self):
        """Calculate performance score based on metrics"""
        if not self.metrics:
            self.performance_score = 0.0
            return

        # Throughput score (40% weight) - target 1,485+ tokens/sec
        throughput_score = min(
            100, (self.metrics["throughput_tokens_per_sec"] / 1485) * 100
        )

        # Response time score (25% weight) - target < 10s
        response_score = max(0, 100 - (self.metrics["average_response_time"] / 100))

        # Memory efficiency score (20% weight) - target < 2GB
        memory_score = max(0, 100 - (self.metrics["memory_usage_mb"] / 20))

        # Uptime score (15% weight)
        uptime_score = 100 if self.status == "running" else 0

        self.performance_score = (
            throughput_score * 0.4
            + response_score * 0.25
            + memory_score * 0.2
            + uptime_score * 0.15
        )


class EnhancedServerManager:
    """Enhanced server manager with advanced monitoring and optimization"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.instances: List[OptimizedServerInstance] = []
        self.is_running = False
        self.background_tasks: List[asyncio.Task] = []
        self.executor = ThreadPoolExecutor(max_workers=8)

        # Performance optimization
        self.start_time = time.time()
        self.global_metrics: Dict[str, Any] = {
            "total_requests": 0,
            "total_tokens": 0,
            "average_throughput": 0.0,
            "peak_throughput": 0.0,
        }

        # Health monitoring
        self.health_check_interval = config.get("health_check_interval", 15)
        self.performance_monitor_interval = config.get(
            "performance_monitor_interval", 10
        )
        self.max_restart_attempts = config.get("max_restart_attempts", 3)
        self.restart_cooldown = config.get("restart_cooldown", 60)

        # Initialize instances
        self._initialize_instances()

        # Setup signal handlers
        self._setup_signal_handlers()

    def _initialize_instances(self):
        """Initialize optimized server instances"""
        mlx_config = self.config["mlx_servers"]
        base_port = mlx_config["base_port"]
        num_instances = mlx_config["instances"]

        for i in range(num_instances):
            instance = OptimizedServerInstance(id=i, port=base_port + i)
            self.instances.append(instance)

        logger.info(f"Initialized {num_instances} enhanced MLX server instances")

    def _setup_signal_handlers(self):
        """Setup graceful shutdown handlers"""

        def signal_handler(signum, frame):
            logger.info(f"Received signal {signum}, shutting down...")
            asyncio.create_task(self.shutdown())

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

    async def start_all_instances(self):
        """Start all MLX server instances with optimization"""
        logger.info("Starting all enhanced MLX server instances...")

        # Start instances in batches to avoid overwhelming the system
        batch_size = 3
        for i in range(0, len(self.instances), batch_size):
            batch = self.instances[i : i + batch_size]
            tasks = [self._start_instance(instance) for instance in batch]
            await asyncio.gather(*tasks, return_exceptions=True)

            # Wait between batches
            await asyncio.sleep(2)

        logger.info("All instances started (or attempted)")

    async def _start_instance(self, instance: OptimizedServerInstance):
        """Start a single enhanced server instance"""
        if instance.status == "running":
            logger.warning(f"Instance {instance.id} is already running")
            return

        try:
            instance.status = "starting"
            instance.start_time = time.time()

            # Prepare command for optimized server
            script_dir = os.path.dirname(os.path.abspath(__file__))
            server_script = os.path.join(script_dir, "optimized_mlx_server.py")
            if not os.path.exists(server_script):
                logger.error(f"Server script not found: {server_script}")
                raise FileNotFoundError(
                    f"Required server script missing: {server_script}"
                )
            cmd = [
                "python3",
                server_script,
                "--port",
                str(instance.port),
                "--instance-id",
                str(instance.id),
                "--batch-size",
                "6",
                "--max-concurrent",
                "12",
                "--quantization",
                "none",  # Already pre-quantized to 8-bit
            ]

            # Start process with optimized settings
            instance.process = subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                preexec_fn=None,
            )

            instance.pid = instance.process.pid
            logger.info(
                f"Started instance {instance.id} on port {instance.port} (PID: {instance.pid})"
            )

            # Wait for startup with timeout
            startup_timeout = 600  # 600 seconds to match system timeout
            start_time = time.time()

            while time.time() - start_time < startup_timeout:
                if await self._check_instance_health(instance):
                    instance.status = "running"
                    instance.last_heartbeat = time.time()
                    logger.info(f"Instance {instance.id} is healthy and running")
                    return

                await asyncio.sleep(1)

            # Startup timeout
            instance.status = "failed"
            logger.error(
                f"Instance {instance.id} failed to start within {startup_timeout} seconds"
            )

            # Clean up failed process
            if instance.process:
                instance.process.terminate()
                await asyncio.sleep(2)
                if instance.process.poll() is None:
                    instance.process.kill()

        except Exception as e:
            instance.status = "failed"
            logger.error(f"Failed to start instance {instance.id}: {e}")

    async def _check_instance_health(self, instance: OptimizedServerInstance) -> bool:
        """Check if an instance is healthy"""
        try:
            timeout = aiohttp.ClientTimeout(total=5)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                url = f"http://localhost:{instance.port}/health"
                async with session.get(url) as response:
                    if response.status == 200:
                        health_data = await response.json()
                        instance.last_heartbeat = time.time()

                        # Update metrics if available
                        if "performance" in health_data:
                            instance.metrics.update(health_data["performance"])
                            instance.update_performance_score()

                        return True
                    else:
                        return False
        except Exception as e:
            logger.debug(f"Health check failed for instance {instance.id}: {e}")
            return False

    async def perform_health_checks(self):
        """Perform comprehensive health checks on all instances"""
        while self.is_running:
            try:
                healthy_count = 0
                total_instances = len(self.instances)

                # Check each instance
                for instance in self.instances:
                    if instance.status == "running":
                        if await self._check_instance_health(instance):
                            healthy_count += 1
                        else:
                            # Instance is unhealthy, attempt restart
                            logger.warning(
                                f"Instance {instance.id} is unhealthy, attempting restart"
                            )
                            await self._restart_instance(instance)

                # Log health summary
                logger.info(
                    f"Health check: {healthy_count}/{total_instances} instances healthy"
                )

                # Update global metrics
                self._update_global_metrics()

                await asyncio.sleep(self.health_check_interval)

            except Exception as e:
                logger.error(f"Health check error: {e}")
                await asyncio.sleep(5)

    async def _restart_instance(self, instance: OptimizedServerInstance):
        """Restart a failed instance with optimization"""
        if instance.restart_count >= self.max_restart_attempts:
            logger.error(
                f"Instance {instance.id} exceeded max restart attempts ({self.max_restart_attempts})"
            )
            instance.status = "failed"
            return

        # Check restart cooldown
        if (
            instance.last_heartbeat
            and (time.time() - instance.last_heartbeat) < self.restart_cooldown
        ):
            logger.info(f"Instance {instance.id} in restart cooldown, waiting...")
            return

        try:
            instance.restart_count += 1
            logger.info(
                f"Restarting instance {instance.id} (attempt {instance.restart_count})"
            )

            # Stop current instance
            await self._stop_instance(instance)
            await asyncio.sleep(2)  # Cooldown

            # Start instance again
            await self._start_instance(instance)

        except Exception as e:
            logger.error(f"Failed to restart instance {instance.id}: {e}")

    async def _stop_instance(self, instance: OptimizedServerInstance):
        """Stop a server instance gracefully"""
        try:
            if instance.process:
                logger.info(
                    f"Stopping instance {instance.id} (PID: {instance.process.pid})"
                )

                # Try graceful shutdown first
                instance.process.terminate()

                # Wait for graceful shutdown
                try:
                    instance.process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    # Force kill if graceful shutdown fails
                    logger.warning(f"Force killing instance {instance.id}")
                    instance.process.kill()
                    instance.process.wait(timeout=5)

                instance.process = None
                instance.pid = None
                instance.status = "stopped"

                logger.info(f"Instance {instance.id} stopped successfully")

        except Exception as e:
            logger.error(f"Error stopping instance {instance.id}: {e}")

    async def perform_performance_monitoring(self):
        """Monitor and optimize performance"""
        while self.is_running:
            try:
                # Collect performance metrics from all instances
                total_throughput = 0
                total_memory = 0
                running_instances = 0

                for instance in self.instances:
                    if instance.status == "running" and instance.metrics:
                        total_throughput += instance.metrics.get(
                            "throughput_tokens_per_sec", 0
                        )
                        total_memory += instance.metrics.get("memory_usage_mb", 0)
                        running_instances += 1

                # Update global metrics
                if running_instances > 0:
                    self.global_metrics["average_throughput"] = (
                        total_throughput / running_instances
                    )
                    self.global_metrics["peak_throughput"] = max(
                        self.global_metrics["peak_throughput"], total_throughput
                    )

                # Performance optimization
                await self._optimize_performance()

                # Log performance summary
                logger.info(
                    f"Performance: {running_instances} running, "
                    f"Avg throughput: {self.global_metrics['average_throughput']:.0f} tokens/sec, "
                    f"Peak: {self.global_metrics['peak_throughput']:.0f} tokens/sec"
                )

                await asyncio.sleep(self.performance_monitor_interval)

            except Exception as e:
                logger.error(f"Performance monitoring error: {e}")
                await asyncio.sleep(5)

    async def _optimize_performance(self):
        """Optimize performance based on current metrics"""
        try:
            running_instances = [
                inst for inst in self.instances if inst.status == "running"
            ]

            if not running_instances:
                return

            # Calculate average performance score
            avg_score = sum(inst.performance_score for inst in running_instances) / len(
                running_instances
            )

            # Performance-based optimizations
            if avg_score < 70:  # Low performance
                logger.warning(f"Low average performance score: {avg_score:.1f}")

                # Restart lowest performing instances
                sorted_instances = sorted(
                    running_instances, key=lambda x: x.performance_score
                )
                low_performers = sorted_instances[: max(1, len(sorted_instances) // 4)]

                for instance in low_performers:
                    if instance.performance_score < 50:
                        logger.info(
                            f"Restarting low-performing instance {instance.id} (score: {instance.performance_score:.1f})"
                        )
                        await self._restart_instance(instance)
                        await asyncio.sleep(5)  # Staggered restart

        except Exception as e:
            logger.error(f"Performance optimization error: {e}")

    def _update_global_metrics(self):
        """Update global system metrics"""
        try:
            running_instances = [
                inst for inst in self.instances if inst.status == "running"
            ]

            if running_instances:
                # Calculate system-wide metrics
                total_requests = sum(
                    inst.metrics.get("requests_processed", 0)
                    for inst in running_instances
                )
                total_tokens = sum(
                    inst.metrics.get("tokens_processed", 0)
                    for inst in running_instances
                )

                self.global_metrics["total_requests"] = total_requests
                self.global_metrics["total_tokens"] = total_tokens

        except Exception as e:
            logger.error(f"Global metrics update error: {e}")

    async def get_system_status(self) -> Dict[str, Any]:
        """Get comprehensive system status"""
        try:
            running_instances = [
                inst for inst in self.instances if inst.status == "running"
            ]
            healthy_instances = [
                inst for inst in running_instances if inst.performance_score > 70
            ]

            total_throughput = sum(
                inst.metrics.get("throughput_tokens_per_sec", 0)
                for inst in running_instances
            )
            avg_response_time = (
                statistics.mean(
                    [
                        inst.metrics.get("average_response_time", 0)
                        for inst in running_instances
                    ]
                )
                if running_instances
                else 0
            )

            return {
                "status": "running" if running_instances else "stopped",
                "timestamp": time.time(),
                "instances": {
                    "total": len(self.instances),
                    "running": len(running_instances),
                    "healthy": len(healthy_instances),
                    "failed": len(
                        [inst for inst in self.instances if inst.status == "failed"]
                    ),
                },
                "performance": {
                    "total_throughput_tokens_per_sec": total_throughput,
                    "average_response_time_ms": avg_response_time,
                    "target_throughput_tokens_per_sec": 1485,
                    "throughput_efficiency": (
                        (total_throughput / 1485) * 100 if total_throughput > 0 else 0
                    ),
                    "peak_throughput_tokens_per_sec": self.global_metrics[
                        "peak_throughput"
                    ],
                },
                "system_metrics": self.global_metrics,
                "individual_instances": [
                    {
                        "id": inst.id,
                        "status": inst.status,
                        "port": inst.port,
                        "pid": inst.pid,
                        "performance_score": inst.performance_score,
                        "metrics": inst.metrics,
                        "restart_count": inst.restart_count,
                    }
                    for inst in self.instances
                ],
            }

        except Exception as e:
            logger.error(f"System status error: {e}")
            return {"status": "error", "error": str(e)}

    async def shutdown(self):
        """Graceful shutdown of all instances"""
        logger.info("Shutting down enhanced MLX server manager...")
        self.is_running = False

        # Cancel background tasks
        for task in self.background_tasks:
            task.cancel()

        # Stop all instances
        stop_tasks = [self._stop_instance(instance) for instance in self.instances]
        await asyncio.gather(*stop_tasks, return_exceptions=True)

        # Shutdown executor
        self.executor.shutdown(wait=True)

        logger.info("Enhanced MLX server manager shutdown complete")


# Web application setup
async def create_enhanced_manager_app(config: Dict[str, Any]) -> web.Application:
    """Create enhanced manager web application"""
    app = web.Application()
    manager = EnhancedServerManager(config)

    # Store manager in app
    app["manager"] = manager

    # Setup routes
    async def system_status_handler(request):
        return web.json_response(await manager.get_system_status())

    async def start_instances_handler(request):
        await manager.start_all_instances()
        return web.json_response({"status": "started"})

    async def stop_instances_handler(request):
        await manager.shutdown()
        return web.json_response({"status": "stopped"})

    app.router.add_get("/status", system_status_handler)
    app.router.add_post("/start", start_instances_handler)
    app.router.add_post("/stop", stop_instances_handler)
    app.router.add_get("/health", lambda req: web.json_response({"status": "healthy"}))

    # Setup background tasks
    async def startup_tasks(app):
        app["health_task"] = asyncio.create_task(manager.perform_health_checks())
        app["performance_task"] = asyncio.create_task(
            manager.perform_performance_monitoring()
        )
        app["manager"] = manager

    async def cleanup_tasks(app):
        if "health_task" in app:
            app["health_task"].cancel()
        if "performance_task" in app:
            app["performance_task"].cancel()
        if "manager" in app:
            await app["manager"].shutdown()

    app.on_startup.append(startup_tasks)
    app.on_cleanup.append(cleanup_tasks)

    return app


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enhanced MLX Server Manager")
    parser.add_argument(
        "--config",
        type=str,
        default="mlx_enhanced_config.json",
        help="Path to configuration file",
    )
    parser.add_argument(
        "--port", type=int, default=8091, help="Port to run the manager on"
    )
    args = parser.parse_args()

    # Load configuration
    try:
        with open(args.config, "r") as f:
            config = json.load(f)
    except Exception as e:
        logger.error(f"Failed to load config from {args.config}: {e}")
        # Fallback config
        config = {
            "mlx_servers": {"base_port": 8107, "instances": 27},
            "health_check_interval": 15,
            "performance_monitor_interval": 10,
            "max_restart_attempts": 3,
            "restart_cooldown": 60,
        }

    # Run enhanced manager
    web.run_app(create_enhanced_manager_app(config), host="0.0.0.0", port=args.port)
