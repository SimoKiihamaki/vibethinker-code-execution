#!/usr/bin/env python3
"""
MLX Load Balancer for VibeThinker
Manages 27 concurrent MLX instances with intelligent load balancing
"""

import asyncio
import json
import logging
import time
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from collections import defaultdict
import aiohttp
import statistics
from aiohttp import web

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class MLXInstance:
    """Represents a single MLX server instance"""
    id: int
    host: str
    port: int
    healthy: bool = True
    active_requests: int = 0
    total_requests: int = 0
    failed_requests: int = 0
    response_times: List[float] = field(default_factory=list)
    last_used: float = field(default_factory=time.time)
    
    @property
    def average_response_time(self) -> float:
        return statistics.mean(self.response_times[-10:]) if self.response_times else 0.0
    
    @property
    def failure_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return self.failed_requests / self.total_requests
    
    @property
    def score(self) -> float:
        """Calculate instance score for load balancing (higher is better)"""
        if not self.healthy:
            return 0.0
        
        # Prefer instances with fewer active requests
        load_score = max(0, 10 - self.active_requests)
        
        # Prefer instances with lower failure rates
        reliability_score = max(0, 10 - (self.failure_rate * 100))
        
        # Prefer instances with faster response times (normalize to 0-10 scale)
        response_score = max(0, 10 - (self.average_response_time / 100))
        
        return (load_score * 0.4) + (reliability_score * 0.4) + (response_score * 0.2)

class CircuitBreaker:
    """Circuit breaker pattern for fault tolerance"""
    
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = 0
        self.state = 'closed'  # closed, open, half-open
    
    def record_success(self):
        self.failure_count = 0
        if self.state == 'half-open':
            self.state = 'closed'
    
    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = 'open'
    
    def can_attempt(self) -> bool:
        if self.state == 'closed':
            return True
        elif self.state == 'open':
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = 'half-open'
                return True
            return False
        elif self.state == 'half-open':
            return True
        
        return False

class MLXLoadBalancer:
    """Intelligent load balancer for MLX instances"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.instances: List[MLXInstance] = []
        self.circuit_breakers: Dict[int, CircuitBreaker] = {}
        self.request_queue: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self.metrics: Dict[str, Any] = defaultdict(int)
        
        # Initialize instances
        self._initialize_instances()
    
    def _initialize_instances(self):
        """Initialize MLX instances based on configuration"""
        mlx_config = self.config['mlx_servers']
        base_port = mlx_config['base_port']
        num_instances = mlx_config['instances']
        
        for i in range(num_instances):
            instance = MLXInstance(
                id=i,
                host='localhost',
                port=base_port + i
            )
            self.instances.append(instance)
            
            # Initialize circuit breaker for each instance
            lb_config = self.config['load_balancer']
            self.circuit_breakers[i] = CircuitBreaker(
                failure_threshold=lb_config['circuit_breaker']['failure_threshold'],
                recovery_timeout=lb_config['circuit_breaker']['recovery_timeout'] / 1000
            )
        
        logger.info(f"Initialized {num_instances} MLX instances on ports {base_port}-{base_port + num_instances - 1}")
    
    async def health_check(self, instance: MLXInstance) -> bool:
        """Perform health check on an MLX instance"""
        try:
            timeout = self.config['load_balancer']['health_check_timeout']
            
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=timeout)) as session:
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
        """Perform health checks on all instances"""
        tasks = [self.health_check(instance) for instance in self.instances]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        healthy_count = sum(1 for result in results if result is True)
        logger.info(f"Health check complete: {healthy_count}/{len(self.instances)} instances healthy")
        
        return healthy_count
    
    def select_instance(self, algorithm: str = 'least_connections') -> Optional[MLXInstance]:
        """Select the best instance based on load balancing algorithm"""
        healthy_instances = [
            inst for inst in self.instances 
            if inst.healthy and self.circuit_breakers[inst.id].can_attempt()
        ]
        
        if not healthy_instances:
            return None
        
        if algorithm == 'round_robin':
            # Simple round-robin based on last used time
            return min(healthy_instances, key=lambda x: x.last_used)
        
        elif algorithm == 'least_connections':
            # Least connections with scoring
            return max(healthy_instances, key=lambda x: x.score)
        
        elif algorithm == 'response_time':
            # Fastest response time
            return min(healthy_instances, key=lambda x: x.average_response_time)
        
        else:
            # Default to least connections
            return max(healthy_instances, key=lambda x: x.score)
    
    async def forward_request(self, instance: MLXInstance, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Forward request to selected MLX instance"""
        start_time = time.time()
        instance.active_requests += 1
        
        try:
            timeout = self.config['performance']['request_timeout'] / 1000
            
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=timeout)) as session:
                url = f"http://{instance.host}:{instance.port}/v1/completions"
                
                async with session.post(url, json=request_data) as response:
                    response_data = await response.json()
                    
                    # Record metrics
                    response_time = (time.time() - start_time) * 1000
                    instance.response_times.append(response_time)
                    instance.total_requests += 1
                    
                    if response.status == 200:
                        self.circuit_breakers[instance.id].record_success()
                        logger.debug(f"Request to instance {instance.id} completed in {response_time:.2f}ms")
                        return response_data
                    else:
                        self.circuit_breakers[instance.id].record_failure()
                        logger.error(f"Request to instance {instance.id} failed with status {response.status}")
                        
                        # Retry logic
                        max_retries = self.config['load_balancer']['max_retries']
                        retry_delay = self.config['load_balancer']['retry_delay'] / 1000
                        
                        for attempt in range(max_retries):
                            await asyncio.sleep(retry_delay * (2 ** attempt))
                            
                            try:
                                async with session.post(url, json=request_data) as retry_response:
                                    if retry_response.status == 200:
                                        retry_data = await retry_response.json()
                                        logger.info(f"Retry attempt {attempt + 1} succeeded for instance {instance.id}")
                                        return retry_data
                            except Exception as retry_error:
                                logger.warning(f"Retry attempt {attempt + 1} failed: {retry_error}")
                        
                        raise Exception(f"All retry attempts failed for instance {instance.id}")
                        
        except Exception as e:
            instance.failed_requests += 1
            self.circuit_breakers[instance.id].record_failure()
            logger.error(f"Request to instance {instance.id} failed: {e}")
            raise
        
        finally:
            instance.active_requests -= 1
            instance.last_used = time.time()
    
    async def handle_completion_request(self, request: web.Request) -> web.Response:
        """Handle completion requests"""
        try:
            request_data = await request.json()
            
            # Select best instance
            instance = self.select_instance()
            if not instance:
                return web.json_response(
                    {"error": "No healthy MLX instances available"}, 
                    status=503
                )
            
            # Forward request to selected instance
            response_data = await self.forward_request(instance, request_data)
            
            # Update metrics
            self.metrics['total_requests'] += 1
            self.metrics['successful_requests'] += 1
            
            return web.json_response(response_data)
            
        except Exception as e:
            logger.error(f"Error handling completion request: {e}")
            self.metrics['failed_requests'] += 1
            return web.json_response(
                {"error": str(e)}, 
                status=500
            )
    
    async def handle_chat_completion_request(self, request: web.Request) -> web.Response:
        """Handle chat completion requests"""
        try:
            request_data = await request.json()
            
            # Select best instance
            instance = self.select_instance()
            if not instance:
                return web.json_response(
                    {"error": "No healthy MLX instances available"}, 
                    status=503
                )
            
            # Forward request to selected instance
            url = f"http://{instance.host}:{instance.port}/v1/chat/completions"
            
            timeout = self.config['performance']['request_timeout'] / 1000
            
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=timeout)) as session:
                async with session.post(url, json=request_data) as response:
                    response_data = await response.json()
                    
                    # Update metrics
                    self.metrics['total_requests'] += 1
                    if response.status == 200:
                        self.metrics['successful_requests'] += 1
                    else:
                        self.metrics['failed_requests'] += 1
                    
                    return web.json_response(response_data, status=response.status)
                    
        except Exception as e:
            logger.error(f"Error handling chat completion request: {e}")
            self.metrics['failed_requests'] += 1
            return web.json_response(
                {"error": str(e)}, 
                status=500
            )
    
    async def handle_metrics_request(self, request: web.Request) -> web.Response:
        """Handle metrics requests"""
        metrics = {
            'total_instances': len(self.instances),
            'healthy_instances': sum(1 for inst in self.instances if inst.healthy),
            'total_requests': self.metrics['total_requests'],
            'successful_requests': self.metrics['successful_requests'],
            'failed_requests': self.metrics['failed_requests'],
            'instances': [
                {
                    'id': inst.id,
                    'port': inst.port,
                    'healthy': inst.healthy,
                    'active_requests': inst.active_requests,
                    'total_requests': inst.total_requests,
                    'failed_requests': inst.failed_requests,
                    'average_response_time': inst.average_response_time,
                    'failure_rate': inst.failure_rate,
                    'score': inst.score,
                }
                for inst in self.instances
            ]
        }
        
        return web.json_response(metrics)
    
    async def start_health_check_loop(self):
        """Start the health check loop"""
        interval = self.config['load_balancer']['health_check_interval']
        
        while True:
            try:
                await self.perform_health_checks()
                await asyncio.sleep(interval)
            except Exception as e:
                logger.error(f"Health check loop error: {e}")
                await asyncio.sleep(interval)
    
    def create_app(self) -> web.Application:
        """Create the web application"""
        app = web.Application()
        
        # Add routes
        app.router.add_post('/v1/completions', self.handle_completion_request)
        app.router.add_post('/v1/chat/completions', self.handle_chat_completion_request)
        app.router.add_get('/metrics', self.handle_metrics_request)
        app.router.add_get('/health', lambda req: web.json_response({'status': 'healthy'}))
        
        return app

async def main():
    """Main function"""
    # Load configuration
    with open('config.json', 'r') as f:
        config = json.load(f)
    
    # Create load balancer
    load_balancer = MLXLoadBalancer(config)
    
    # Start health check loop
    health_check_task = asyncio.create_task(load_balancer.start_health_check_loop())
    
    # Create and start web application
    app = load_balancer.create_app()
    
    # Get configuration
    mlx_config = config['mlx_servers']
    host = mlx_config.get('host', '0.0.0.0')
    port = mlx_config.get('load_balancer_port', 8000)
    
    logger.info(f"Starting MLX load balancer on {host}:{port}")
    
    runner = web.AppRunner(app)
    await runner.setup()
    
    site = web.TCPSite(runner, host, port)
    await site.start()
    
    logger.info(f"MLX load balancer started successfully")
    
    try:
        # Keep the server running
        await asyncio.Event().wait()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    finally:
        health_check_task.cancel()
        await runner.cleanup()

if __name__ == '__main__':
    asyncio.run(main())