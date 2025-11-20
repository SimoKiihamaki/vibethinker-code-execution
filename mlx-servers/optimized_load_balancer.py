#!/usr/bin/env python3
"""
Optimized MLX Load Balancer for VibeThinker
Enhanced performance for 1,485+ tokens/sec throughput
"""

import asyncio
import json
import logging
import time
import threading
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from collections import defaultdict, deque
import aiohttp
import statistics
from aiohttp import web
import numpy as np
from concurrent.futures import ThreadPoolExecutor
import gc
import psutil

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@dataclass
class OptimizedMLXInstance:
    """Optimized MLX server instance with enhanced performance tracking"""

    id: int
    host: str
    port: int
    healthy: bool = True
    active_requests: int = 0
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    response_times: deque = field(default_factory=lambda: deque(maxlen=100))
    tokens_processed: int = 0
    last_used: float = field(default_factory=time.time)
    throughput_history: deque = field(default_factory=lambda: deque(maxlen=10))

    @property
    def average_response_time(self) -> float:
        return statistics.mean(self.response_times) if self.response_times else 0.0

    @property
    def current_throughput(self) -> float:
        """Calculate current throughput in tokens/sec"""
        if not self.throughput_history:
            return 0.0
        return statistics.mean(self.throughput_history)

    @property
    def failure_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return self.failed_requests / self.total_requests

    @property
    def success_rate(self) -> float:
        if self.total_requests == 0:
            return 1.0
        return self.successful_requests / self.total_requests

    @property
    def performance_score(self) -> float:
        """Calculate comprehensive performance score (0-100)"""
        if not self.healthy:
            return 0.0

        # Throughput score (40% weight) - target 1,485+ tokens/sec
        throughput_score = min(100, (self.current_throughput / 1485) * 100)

        # Response time score (25% weight) - target < 10s
        response_score = max(0, 100 - (self.average_response_time / 100))

        # Success rate score (20% weight) - target > 95%
        success_score = self.success_rate * 100

        # Load balance score (15% weight) - prefer less loaded instances
        load_score = max(0, 100 - (self.active_requests * 10))

        return (
            throughput_score * 0.4
            + response_score * 0.25
            + success_score * 0.2
            + load_score * 0.15
        )


class EnhancedCircuitBreaker:
    """Enhanced circuit breaker with adaptive thresholds"""

    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = 0
        self.last_success_time = 0
        self.state = "closed"  # closed, open, half-open
        self.adaptive_threshold = failure_threshold

    def record_success(self):
        self.success_count += 1
        self.last_success_time = time.time()
        self.failure_count = 0

        if self.state == "half-open":
            self.state = "closed"
            self.adaptive_threshold = max(3, self.adaptive_threshold - 1)

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.failure_count >= self.adaptive_threshold:
            self.state = "open"
            self.adaptive_threshold = min(10, self.adaptive_threshold + 1)

    def can_attempt(self) -> bool:
        if self.state == "closed":
            return True
        elif self.state == "open":
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = "half-open"
                return True
            return False
        elif self.state == "half-open":
            return True
        return False


class TokenBatchProcessor:
    """Batch processor for improved throughput"""

    def __init__(self, max_batch_size: int = 5, max_wait_time: float = 0.1):
        self.max_batch_size = max_batch_size
        self.max_wait_time = max_wait_time
        self.pending_requests: List[Dict[str, Any]] = []
        self.batch_lock = asyncio.Lock()
        self.processing_event = asyncio.Event()

    async def add_request(self, request_data: Dict[str, Any]) -> asyncio.Future:
        """Add request to batch and return future for response"""
        future = asyncio.Future()

        async with self.batch_lock:
            self.pending_requests.append(
                {"data": request_data, "future": future, "timestamp": time.time()}
            )

            if len(self.pending_requests) >= self.max_batch_size:
                self.processing_event.set()

        return future

    async def process_batch(
        self, instance: OptimizedMLXInstance
    ) -> List[Dict[str, Any]]:
        """Process a batch of requests"""
        async with self.batch_lock:
            if not self.pending_requests:
                return []

            batch = self.pending_requests[: self.max_batch_size]
            self.pending_requests = self.pending_requests[self.max_batch_size :]

            return batch


class OptimizedMLXLoadBalancer:
    """High-performance load balancer for MLX instances"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.instances: List[OptimizedMLXInstance] = []
        self.circuit_breakers: Dict[int, EnhancedCircuitBreaker] = {}
        self.request_queue: asyncio.Queue = asyncio.Queue(maxsize=2000)
        self.metrics: Dict[str, Any] = defaultdict(int)

        # Performance optimization
        self.batch_processors: Dict[int, TokenBatchProcessor] = {}
        self.connection_pool: Optional[aiohttp.ClientSession] = None
        self.executor = ThreadPoolExecutor(max_workers=4)

        # Performance monitoring
        self.global_throughput: deque = deque(maxlen=60)  # 1 minute of data
        self.request_latency: deque = deque(maxlen=1000)
        self.start_time = time.time()

        # Initialize instances
        self._initialize_instances()
        # self._start_background_tasks() - Moved to on_startup

    def _initialize_instances(self):
        """Initialize MLX instances with optimized configuration"""
        mlx_config = self.config["mlx_servers"]
        base_port = mlx_config["base_port"]
        num_instances = mlx_config["instances"]

        for i in range(num_instances):
            instance = OptimizedMLXInstance(id=i, host="localhost", port=base_port + i)
            self.instances.append(instance)

            # Initialize circuit breaker and batch processor
            lb_config = self.config["load_balancer"]
            self.circuit_breakers[i] = EnhancedCircuitBreaker(
                failure_threshold=lb_config["circuit_breaker"]["failure_threshold"],
                recovery_timeout=lb_config["circuit_breaker"]["recovery_timeout"],
            )
            self.batch_processors[i] = TokenBatchProcessor(
                max_batch_size=lb_config.get("max_batch_size", 5),
                max_wait_time=lb_config.get("max_batch_wait", 0.1),
            )

        logger.info(f"Initialized {num_instances} optimized MLX instances")

    def _start_background_tasks(self):
        """Start background optimization tasks"""
        # Start connection pool manager
        asyncio.create_task(self._manage_connection_pool())

        # Start performance monitoring
        asyncio.create_task(self._monitor_performance())

        # Start garbage collection optimizer
        asyncio.create_task(self._optimize_memory())

        # Start throughput optimizer
        asyncio.create_task(self._optimize_throughput())

    async def _manage_connection_pool(self):
        """Manage HTTP connection pool for optimal performance"""
        while True:
            try:
                if self.connection_pool is None or self.connection_pool.closed:
                    connector = aiohttp.TCPConnector(
                        limit=100,  # Total connection limit
                        limit_per_host=10,  # Per-host connection limit
                        ttl_dns_cache=300,  # DNS cache TTL
                        use_dns_cache=True,
                        keepalive_timeout=30,
                        enable_cleanup_closed=True,
                    )

                    timeout = aiohttp.ClientTimeout(total=30, connect=5, sock_read=25)

                    self.connection_pool = aiohttp.ClientSession(
                        connector=connector,
                        timeout=timeout,
                        headers={"Connection": "keep-alive"},
                    )

                await asyncio.sleep(60)  # Check every minute

            except Exception as e:
                logger.error(f"Connection pool management error: {e}")
                await asyncio.sleep(10)

    async def _monitor_performance(self):
        """Monitor and log system performance metrics"""
        while True:
            try:
                # Calculate current throughput
                total_tokens = sum(inst.tokens_processed for inst in self.instances)
                current_throughput = total_tokens / max(
                    1, time.time() - self.start_time
                )
                self.global_throughput.append(current_throughput)

                # Log performance metrics
                healthy_instances = sum(1 for inst in self.instances if inst.healthy)
                avg_throughput = (
                    statistics.mean(self.global_throughput)
                    if self.global_throughput
                    else 0
                )

                logger.info(
                    f"Performance: {healthy_instances}/{len(self.instances)} healthy, "
                    f"Throughput: {current_throughput:.0f} tokens/sec, "
                    f"Avg: {avg_throughput:.0f} tokens/sec"
                )

                await asyncio.sleep(10)  # Log every 10 seconds

            except Exception as e:
                logger.error(f"Performance monitoring error: {e}")
                await asyncio.sleep(5)

    async def _optimize_memory(self):
        """Optimize memory usage for better performance"""
        while True:
            try:
                # Force garbage collection
                gc.collect()

                # Monitor memory usage
                memory = psutil.virtual_memory()
                if memory.percent > 80:
                    logger.warning(f"High memory usage: {memory.percent}%")
                    # Reduce batch sizes under memory pressure
                    for processor in self.batch_processors.values():
                        processor.max_batch_size = max(1, processor.max_batch_size - 1)

                await asyncio.sleep(30)  # Optimize every 30 seconds

            except Exception as e:
                logger.error(f"Memory optimization error: {e}")
                await asyncio.sleep(10)

    async def _optimize_throughput(self):
        """Dynamically optimize throughput based on performance metrics"""
        while True:
            try:
                # Analyze instance performance
                for instance in self.instances:
                    if instance.total_requests > 10:
                        current_tps = instance.current_throughput

                        # Adjust batch size based on throughput
                        processor = self.batch_processors[instance.id]
                        if current_tps < 1000:  # Below target
                            processor.max_batch_size = min(
                                10, processor.max_batch_size + 1
                            )
                        elif current_tps > 2000:  # Above target
                            processor.max_batch_size = max(
                                2, processor.max_batch_size - 1
                            )

                await asyncio.sleep(15)  # Optimize every 15 seconds

            except Exception as e:
                logger.error(f"Throughput optimization error: {e}")
                await asyncio.sleep(5)

    async def health_check(self, instance: OptimizedMLXInstance) -> bool:
        """Optimized health check with connection pooling"""
        try:
            timeout = self.config["load_balancer"]["health_check_timeout"]

            if self.connection_pool and not self.connection_pool.closed:
                url = f"http://{instance.host}:{instance.port}/health"
                async with self.connection_pool.get(url, timeout=timeout) as response:
                    if response.status == 200:
                        instance.healthy = True
                        self.circuit_breakers[instance.id].record_success()
                        return True
                    else:
                        instance.healthy = False
                        self.circuit_breakers[instance.id].record_failure()
                        return False
            else:
                # Fallback to new session
                async with aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=timeout)
                ) as session:
                    url = f"http://{instance.host}:{instance.port}/health"
                    async with session.get(url) as response:
                        if response.status == 200:
                            instance.healthy = True
                            self.circuit_breakers[instance.id].record_success()
                            return True
                        else:
                            instance.healthy = False
                            self.circuit_breakers[instance.id].record_failure()
                            return False

        except Exception as e:
            logger.warning(f"Health check failed for instance {instance.id}: {e}")
            instance.healthy = False
            self.circuit_breakers[instance.id].record_failure()
            return False

    async def perform_health_checks(self):
        """Perform health checks on all instances with concurrency limit"""
        # Limit concurrent health checks to avoid overwhelming instances
        semaphore = asyncio.Semaphore(5)

        async def limited_health_check(instance):
            async with semaphore:
                return await self.health_check(instance)

        tasks = [limited_health_check(instance) for instance in self.instances]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        healthy_count = sum(1 for result in results if result is True)
        logger.info(
            f"Health check complete: {healthy_count}/{len(self.instances)} instances healthy"
        )

        return healthy_count

    def select_instance(
        self, algorithm: str = "performance"
    ) -> Optional[OptimizedMLXInstance]:
        """Select the best instance using advanced algorithms"""
        healthy_instances = [
            inst
            for inst in self.instances
            if inst.healthy and self.circuit_breakers[inst.id].can_attempt()
        ]

        if not healthy_instances:
            return None

        if algorithm == "round_robin":
            # Round-robin with performance bias
            return min(
                healthy_instances, key=lambda x: (x.last_used, -x.performance_score)
            )

        elif algorithm == "least_connections":
            # Least connections with performance scoring
            return min(
                healthy_instances,
                key=lambda x: (x.active_requests, -x.performance_score),
            )

        elif algorithm == "response_time":
            # Fastest response time with throughput consideration
            return min(
                healthy_instances,
                key=lambda x: (x.average_response_time, -x.current_throughput),
            )

        elif algorithm == "performance":
            # Performance-based selection (default)
            return max(healthy_instances, key=lambda x: x.performance_score)

        else:
            # Default to performance-based selection
            return max(healthy_instances, key=lambda x: x.performance_score)

    async def _forward_to_instance(
        self,
        instance: OptimizedMLXInstance,
        request_data: Dict[str, Any],
        url: str,
        estimated_tokens: float,
        timeout: float,
    ) -> Tuple[Dict[str, Any], int, float, float]:
        """Shared HTTP forwarding helper that captures response status inside context."""
        start_time = time.time()
        instance.active_requests += 1
        status_code = None
        response_data: Dict[str, Any] = {}

        try:
            session = (
                self.connection_pool
                if self.connection_pool and not self.connection_pool.closed
                else None
            )

            if session:
                async with session.post(
                    url, json=request_data, timeout=timeout
                ) as response:
                    status_code = response.status
                    response_data = await response.json()
            else:
                async with aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=timeout)
                ) as temp_session:
                    async with temp_session.post(url, json=request_data) as response:
                        status_code = response.status
                        response_data = await response.json()

            # Update tokens from actual usage if available
            total_tokens_count = response_data.get("usage", {}).get(
                "total_tokens", estimated_tokens
            )

            response_time = (time.time() - start_time) * 1000
            instance.response_times.append(response_time)
            instance.total_requests += 1
            instance.tokens_processed += total_tokens_count

            current_throughput = (
                total_tokens_count / (response_time / 1000) if response_time > 0 else 0
            )
            instance.throughput_history.append(current_throughput)

            if status_code == 200:
                instance.successful_requests += 1
                self.circuit_breakers[instance.id].record_success()
            else:
                instance.failed_requests += 1
                self.circuit_breakers[instance.id].record_failure()

            return response_data, status_code or 0, response_time, current_throughput

        except Exception as e:
            instance.failed_requests += 1
            self.circuit_breakers[instance.id].record_failure()
            logger.error(f"Request to instance {instance.id} failed: {e}")
            raise

        finally:
            instance.active_requests -= 1
            instance.last_used = time.time()

    async def forward_request(
        self, instance: OptimizedMLXInstance, request_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Optimized request forwarding with batching and connection pooling"""
        try:
            # Extract token count for throughput calculation
            estimated_tokens = (
                len(request_data.get("prompt", "").split()) * 1.3
            )  # Rough estimate

            timeout = self.config["performance"]["request_timeout"] / 1000
            url = f"http://{instance.host}:{instance.port}/v1/completions"
            response_data, status_code, response_time, current_throughput = (
                await self._forward_to_instance(
                    instance, request_data, url, estimated_tokens, timeout
                )
            )

            if status_code == 200:
                logger.debug(
                    f"Request to instance {instance.id} completed in {response_time:.2f}ms, "
                    f"throughput: {current_throughput:.0f} tokens/sec"
                )
                return response_data

            logger.error(
                f"Request to instance {instance.id} failed with status {status_code}"
            )
            return await self._retry_request(
                instance, request_data, url, timeout, max_retries=2
            )

        except Exception as e:
            logger.error(f"Request to instance {instance.id} failed: {e}")
            raise

    async def _retry_request(
        self,
        instance: OptimizedMLXInstance,
        request_data: Dict[str, Any],
        url: str,
        timeout: float,
        max_retries: int,
    ) -> Dict[str, Any]:
        """Implement retry logic with exponential backoff"""
        for attempt in range(max_retries):
            retry_delay = 0.5 * (2**attempt)  # Exponential backoff
            await asyncio.sleep(retry_delay)

            try:
                # Calculate estimated tokens for this retry attempt
                estimated_tokens = (
                    (len(request_data.get("prompt", "").split()) * 1.3)
                    if "prompt" in request_data
                    else (
                        len(
                            " ".join(
                                [
                                    m.get("content", "")
                                    for m in request_data.get("messages", [])
                                ]
                            ).split()
                        )
                        * 1.3
                    )
                )

                # Reuse _forward_to_instance for proper accounting
                response_data, status_code, response_time, current_throughput = (
                    await self._forward_to_instance(
                        instance, request_data, url, estimated_tokens, timeout
                    )
                )

                if status_code == 200:
                    logger.info(
                        f"Retry attempt {attempt + 1} succeeded for instance {instance.id}"
                    )
                    return response_data
                else:
                    logger.warning(
                        f"Retry attempt {attempt + 1} failed with status {status_code} for instance {instance.id}"
                    )

            except Exception as retry_error:
                logger.warning(f"Retry attempt {attempt + 1} failed: {retry_error}")

        raise Exception(f"All retry attempts failed for instance {instance.id}")

    async def handle_completion_request(self, request: web.Request) -> web.Response:
        """Handle completion requests with optimization"""
        try:
            request_data = await request.json()

            # Select best instance using performance algorithm
            instance = self.select_instance("performance")

            if not instance:
                logger.error("No healthy MLX instances available")
                return web.json_response(
                    {"error": "No healthy MLX instances available"}, status=503
                )

            # Forward request to selected instance
            response_data = await self.forward_request(instance, request_data)

            # Add performance metadata
            response_data["_performance"] = {
                "instance_id": instance.id,
                "response_time": instance.average_response_time,
                "throughput": instance.current_throughput,
                "active_requests": instance.active_requests,
            }

            return web.json_response(response_data)

        except Exception as e:
            logger.error(f"Error handling completion request: {e}")
            return web.json_response(
                {"error": f"Internal server error: {str(e)}"}, status=500
            )

    async def handle_chat_completion_request(
        self, request: web.Request
    ) -> web.Response:
        """Handle chat completion requests with optimization"""
        try:
            request_data = await request.json()

            # Select best instance using performance algorithm
            instance = self.select_instance("performance")

            if not instance:
                logger.error("No healthy MLX instances available")
                return web.json_response(
                    {"error": "No healthy MLX instances available"}, status=503
                )

            # Forward request to selected instance
            # Note: forward_request handles /v1/completions, we need to adapt it or create a new one for chat
            # For simplicity and reuse, we'll modify forward_request to accept an endpoint or create a specific one.
            # Let's create a specific one for chat to be safe and explicit.

            try:
                # Extract token count for throughput calculation (rough estimate)
                messages = request_data.get("messages", [])
                content = " ".join([m.get("content", "") for m in messages])
                estimated_tokens = len(content.split()) * 1.3

                timeout = self.config["performance"]["request_timeout"] / 1000
                url = f"http://{instance.host}:{instance.port}/v1/chat/completions"

                response_data, status_code, response_time, _ = (
                    await self._forward_to_instance(
                        instance, request_data, url, estimated_tokens, timeout
                    )
                )

                if status_code == 200:
                    logger.debug(
                        f"Chat request to instance {instance.id} completed in {response_time:.2f}ms"
                    )

                    response_data["_performance"] = {
                        "instance_id": instance.id,
                        "response_time": instance.average_response_time,
                        "throughput": instance.current_throughput,
                        "active_requests": instance.active_requests,
                    }

                    return web.json_response(response_data)

                logger.error(
                    f"Chat request to instance {instance.id} failed with status {status_code}"
                )
                retry_response = await self._retry_request(
                    instance, request_data, url, timeout, max_retries=2
                )
                return web.json_response(retry_response)

            except Exception as e:
                logger.error(f"Chat request to instance {instance.id} failed: {e}")
                raise

        except Exception as e:
            logger.error(f"Error handling chat completion request: {e}")
            return web.json_response(
                {"error": f"Internal server error: {str(e)}"}, status=500
            )

    async def get_metrics(self) -> Dict[str, Any]:
        """Get comprehensive performance metrics"""
        total_tokens = sum(inst.tokens_processed for inst in self.instances)
        total_requests = sum(inst.total_requests for inst in self.instances)
        healthy_instances = sum(1 for inst in self.instances if inst.healthy)

        # Calculate throughput metrics
        current_throughput = total_tokens / max(1, time.time() - self.start_time)
        avg_throughput = (
            statistics.mean(self.global_throughput) if self.global_throughput else 0
        )

        # Instance performance breakdown
        instance_metrics = []
        for instance in self.instances:
            instance_metrics.append(
                {
                    "id": instance.id,
                    "healthy": instance.healthy,
                    "active_requests": instance.active_requests,
                    "total_requests": instance.total_requests,
                    "success_rate": instance.success_rate,
                    "avg_response_time": instance.average_response_time,
                    "current_throughput": instance.current_throughput,
                    "tokens_processed": instance.tokens_processed,
                    "performance_score": instance.performance_score,
                }
            )

        return {
            "system": {
                "healthy_instances": healthy_instances,
                "total_instances": len(self.instances),
                "uptime_seconds": time.time() - self.start_time,
                "total_tokens_processed": total_tokens,
                "total_requests": total_requests,
            },
            "performance": {
                "current_throughput_tokens_per_sec": current_throughput,
                "average_throughput_tokens_per_sec": avg_throughput,
                "target_throughput_tokens_per_sec": 1485,
                "throughput_efficiency": (
                    (current_throughput / 1485) * 100 if avg_throughput > 0 else 0
                ),
            },
            "instances": instance_metrics,
            "timestamp": time.time(),
        }


# Web application setup
def create_optimized_app(config: Dict[str, Any]) -> web.Application:
    """Create optimized web application"""
    app = web.Application()
    load_balancer = OptimizedMLXLoadBalancer(config)

    # Store load balancer in app
    app["load_balancer"] = load_balancer

    # Setup routes
    app.router.add_post("/v1/completions", load_balancer.handle_completion_request)
    app.router.add_post(
        "/v1/chat/completions", load_balancer.handle_chat_completion_request
    )
    app.router.add_get("/health", lambda req: web.json_response({"status": "healthy"}))

    async def metrics_handler(req):
        metrics = await load_balancer.get_metrics()
        return web.json_response(metrics)

    app.router.add_get("/metrics", metrics_handler)

    # Setup background tasks
    async def background_health_checks(app):
        while True:
            try:
                await load_balancer.perform_health_checks()
                await asyncio.sleep(30)  # Health check every 30 seconds
            except Exception as e:
                logger.error(f"Background health check error: {e}")
                await asyncio.sleep(10)

    async def start_bg_checks(app):
        asyncio.create_task(background_health_checks(app))

    app.on_startup.append(start_bg_checks)

    # Start load balancer background tasks
    async def start_lb_tasks(app):
        load_balancer._start_background_tasks()

    app.on_startup.append(start_lb_tasks)

    return app


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Optimized MLX Load Balancer")
    parser.add_argument(
        "--config",
        type=str,
        default="optimized_lb_config.json",
        help="Path to configuration file",
    )
    parser.add_argument(
        "--port", type=int, default=8090, help="Port to run the load balancer on"
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
            "mlx_servers": {"base_port": 8080, "instances": 27},
            "load_balancer": {
                "health_check_timeout": 5,
                "circuit_breaker": {"failure_threshold": 5, "recovery_timeout": 60},
                "max_retries": 2,
                "retry_delay": 500,
                "max_batch_size": 8,
                "max_batch_wait": 0.05,
            },
            "performance": {"request_timeout": 180000},
        }

    # Create and run optimized app
    web.run_app(create_optimized_app(config), host="0.0.0.0", port=args.port)
