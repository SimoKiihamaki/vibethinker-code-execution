#!/usr/bin/env python3
"""
Health Check Script for VibeThinker MLX System
Monitors the health and performance of all MLX instances
"""

import asyncio
import json
import logging
import sys
import time
from typing import Dict, List, Optional
import aiohttp
import statistics
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class HealthChecker:
    """Health checker for MLX system components"""

    def __init__(self, config: Dict[str, any]):
        self.config = config
        self.results = {}
        self.start_time = time.time()

    async def check_load_balancer(self) -> Dict[str, any]:
        """Check load balancer health"""
        try:
            lb_config = self.config["load_balancer"]
            host = self.config["mlx_servers"].get("host", "localhost")
            port = self.config["mlx_servers"].get("load_balancer_port", 8000)

            url = f"http://{host}:{port}/health"

            async with aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=5)
            ) as session:
                start_time = time.time()
                async with session.get(url) as response:
                    response_time = (time.time() - start_time) * 1000

                    if response.status == 200:
                        return {
                            "status": "healthy",
                            "response_time_ms": response_time,
                            "url": url,
                            "timestamp": datetime.now().isoformat(),
                        }
                    else:
                        return {
                            "status": "unhealthy",
                            "error": f"HTTP {response.status}",
                            "response_time_ms": response_time,
                            "url": url,
                            "timestamp": datetime.now().isoformat(),
                        }

        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "url": f"http://{host}:{port}/health",
                "timestamp": datetime.now().isoformat(),
            }

    async def check_mlx_instances(self) -> List[Dict[str, any]]:
        """Check individual MLX instances"""
        mlx_config = self.config["mlx_servers"]
        base_port = mlx_config["base_port"]
        num_instances = mlx_config["instances"]
        host = mlx_config.get("host", "localhost")

        results = []

        for i in range(num_instances):
            port = base_port + i
            url = f"http://{host}:{port}/health"

            try:
                async with aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=3)
                ) as session:
                    start_time = time.time()
                    async with session.get(url) as response:
                        response_time = (time.time() - start_time) * 1000

                        results.append(
                            {
                                "instance_id": i,
                                "port": port,
                                "status": (
                                    "healthy" if response.status == 200 else "unhealthy"
                                ),
                                "response_time_ms": response_time,
                                "error": (
                                    None
                                    if response.status == 200
                                    else f"HTTP {response.status}"
                                ),
                                "timestamp": datetime.now().isoformat(),
                            }
                        )

            except Exception as e:
                results.append(
                    {
                        "instance_id": i,
                        "port": port,
                        "status": "error",
                        "response_time_ms": None,
                        "error": str(e),
                        "timestamp": datetime.now().isoformat(),
                    }
                )

        return results

    async def check_mcp_server(self) -> Dict[str, any]:
        """Check MCP server health"""
        try:
            # This would check if MCP server is responsive
            # For now, we'll check if the process is running
            import psutil

            # Look for MCP server process
            for proc in psutil.process_iter(["pid", "name", "cmdline"]):
                try:
                    cmdline = proc.info.get("cmdline", [])
                    if cmdline and any(
                        "mcp-server/dist/index.js" in str(arg) for arg in cmdline
                    ):
                        return {
                            "status": "healthy",
                            "pid": proc.info["pid"],
                            "name": proc.info["name"],
                            "timestamp": datetime.now().isoformat(),
                        }
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue

            return {
                "status": "unhealthy",
                "error": "MCP server process not found",
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat(),
            }

    async def check_system_resources(self) -> Dict[str, any]:
        """Check system resource usage"""
        try:
            import psutil

            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)

            # Memory usage
            memory = psutil.virtual_memory()

            # GPU memory (if available)
            gpu_memory = None
            try:
                # Try to get GPU memory usage
                result = subprocess.run(
                    ["system_profiler", "SPDisplaysDataType"],
                    capture_output=True,
                    text=True,
                )

                if "Metal" in result.stdout:
                    gpu_memory = "Metal GPU detected"
            except:
                # system_profiler command not available or failed
                pass

            # Disk usage
            disk = psutil.disk_usage("/")

            return {
                "status": "healthy",
                "cpu_percent": cpu_percent,
                "memory_percent": memory.percent,
                "memory_available_gb": memory.available / (1024**3),
                "disk_percent": disk.percent,
                "disk_free_gb": disk.free / (1024**3),
                "gpu_memory": gpu_memory,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat(),
            }

    async def run_performance_test(self) -> Dict[str, any]:
        """Run a simple performance test"""
        try:
            mlx_config = self.config["mlx_servers"]
            host = mlx_config.get("host", "localhost")
            port = mlx_config.get("load_balancer_port", 8000)

            test_prompt = "What is the capital of France? Answer in one word."

            results = []

            # Run multiple requests
            for i in range(5):
                start_time = time.time()

                async with aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as session:
                    url = f"http://{host}:{port}/v1/completions"
                    data = {
                        "model": mlx_config["model_path"],
                        "prompt": test_prompt,
                        "max_tokens": 10,
                        "temperature": 0.1,
                    }

                    async with session.post(url, json=data) as response:
                        if response.status == 200:
                            response_data = await response.json()
                            response_time = (time.time() - start_time) * 1000

                            results.append(
                                {
                                    "request_id": i,
                                    "response_time_ms": response_time,
                                    "tokens_generated": response_data.get(
                                        "usage", {}
                                    ).get("completion_tokens", 0),
                                    "status": "success",
                                }
                            )
                        else:
                            results.append(
                                {
                                    "request_id": i,
                                    "response_time_ms": None,
                                    "tokens_generated": 0,
                                    "status": f"HTTP {response.status}",
                                }
                            )

            # Calculate statistics
            successful_results = [r for r in results if r["status"] == "success"]

            if successful_results:
                avg_response_time = statistics.mean(
                    r["response_time_ms"] for r in successful_results
                )
                avg_tokens_per_second = statistics.mean(
                    r["tokens_generated"] / (r["response_time_ms"] / 1000)
                    for r in successful_results
                    if r["response_time_ms"] > 0
                )
            else:
                avg_response_time = None
                avg_tokens_per_second = None

            return {
                "status": "completed",
                "total_requests": len(results),
                "successful_requests": len(successful_results),
                "avg_response_time_ms": avg_response_time,
                "avg_tokens_per_second": avg_tokens_per_second,
                "results": results,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat(),
            }

    async def run_full_check(self) -> Dict[str, any]:
        """Run complete health check"""
        logger.info("Starting full health check...")

        start_time = time.time()

        # Run all checks in parallel
        tasks = [
            self.check_load_balancer(),
            self.check_mlx_instances(),
            self.check_mcp_server(),
            self.check_system_resources(),
            self.run_performance_test(),
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "duration_seconds": time.time() - start_time,
            "load_balancer": (
                results[0]
                if not isinstance(results[0], Exception)
                else {"status": "error", "error": str(results[0])}
            ),
            "mlx_instances": (
                results[1] if not isinstance(results[1], Exception) else []
            ),
            "mcp_server": (
                results[2]
                if not isinstance(results[2], Exception)
                else {"status": "error", "error": str(results[2])}
            ),
            "system_resources": (
                results[3]
                if not isinstance(results[3], Exception)
                else {"status": "error", "error": str(results[3])}
            ),
            "performance_test": (
                results[4]
                if not isinstance(results[4], Exception)
                else {"status": "error", "error": str(results[4])}
            ),
        }

        # Calculate overall health
        self.results["overall_health"] = self.calculate_overall_health()

        logger.info("Full health check completed")
        return self.results

    def calculate_overall_health(self) -> str:
        """Calculate overall system health"""
        checks = [
            self.results.get("load_balancer", {}).get("status") == "healthy",
            len(
                [
                    inst
                    for inst in self.results.get("mlx_instances", [])
                    if inst.get("status") == "healthy"
                ]
            )
            > 20,  # At least 20 healthy instances
            self.results.get("mcp_server", {}).get("status")
            in ["healthy", "unhealthy"],  # Not error
            self.results.get("system_resources", {}).get("status") == "healthy",
            self.results.get("performance_test", {}).get("status") == "completed",
        ]

        healthy_checks = sum(checks)
        total_checks = len(checks)

        if healthy_checks == total_checks:
            return "healthy"
        elif healthy_checks >= total_checks * 0.7:  # 70% threshold
            return "degraded"
        else:
            return "unhealthy"

    def print_summary(self):
        """Print health check summary"""
        if not self.results:
            print("No health check results available")
            return

        print("\n" + "=" * 60)
        print("VIBETHINKER MLX SYSTEM HEALTH CHECK")
        print("=" * 60)

        # Overall health
        overall_health = self.results.get("overall_health", "unknown")
        health_color = {
            "healthy": "\033[92m",  # Green
            "degraded": "\033[93m",  # Yellow
            "unhealthy": "\033[91m",  # Red
        }.get(
            overall_health, "\033[90m"
        )  # Gray

        print(f"\nOverall Health: {health_color}{overall_health.upper()}\033[0m")
        print(f"Check Duration: {self.results.get('duration_seconds', 0):.2f}s")
        print(f"Timestamp: {self.results.get('timestamp', 'N/A')}")

        # Load Balancer
        lb_result = self.results.get("load_balancer", {})
        lb_status = lb_result.get("status", "unknown")
        print(f"\nLoad Balancer: {lb_status}")
        if lb_result.get("response_time_ms"):
            print(f"  Response Time: {lb_result['response_time_ms']:.1f}ms")

        # MLX Instances
        instances = self.results.get("mlx_instances", [])
        healthy_instances = len(
            [inst for inst in instances if inst.get("status") == "healthy"]
        )
        print(f"\nMLX Instances: {healthy_instances}/{len(instances)} healthy")

        if instances:
            response_times = [
                inst.get("response_time_ms")
                for inst in instances
                if inst.get("response_time_ms")
            ]
            if response_times:
                avg_response = statistics.mean(response_times)
                print(f"  Avg Response Time: {avg_response:.1f}ms")

        # System Resources
        sys_result = self.results.get("system_resources", {})
        if sys_result.get("status") == "healthy":
            print(f"\nSystem Resources:")
            print(f"  CPU: {sys_result.get('cpu_percent', 0):.1f}%")
            print(f"  Memory: {sys_result.get('memory_percent', 0):.1f}%")
            print(f"  Disk: {sys_result.get('disk_percent', 0):.1f}%")

        # Performance Test
        perf_result = self.results.get("performance_test", {})
        if perf_result.get("status") == "completed":
            print(f"\nPerformance Test:")
            print(
                f"  Successful Requests: {perf_result.get('successful_requests', 0)}/{perf_result.get('total_requests', 0)}"
            )
            if perf_result.get("avg_response_time_ms"):
                print(
                    f"  Avg Response Time: {perf_result['avg_response_time_ms']:.1f}ms"
                )
            if perf_result.get("avg_tokens_per_second"):
                print(
                    f"  Avg Tokens/Second: {perf_result['avg_tokens_per_second']:.1f}"
                )

        print("\n" + "=" * 60)


async def main():
    """Main function"""
    # Load configuration
    config_path = "mlx-servers/config.json"

    if not os.path.exists(config_path):
        logger.error(f"Configuration file not found: {config_path}")
        sys.exit(1)

    with open(config_path, "r") as f:
        config = json.load(f)

    # Create health checker
    checker = HealthChecker(config)

    # Run health check
    results = await checker.run_full_check()

    # Print summary
    checker.print_summary()

    # Exit with appropriate code
    overall_health = results.get("overall_health", "unhealthy")
    sys.exit(0 if overall_health == "healthy" else 1)


if __name__ == "__main__":
    asyncio.run(main())
