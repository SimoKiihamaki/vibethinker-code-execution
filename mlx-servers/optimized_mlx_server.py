#!/usr/bin/env python3
"""
Optimized MLX Server Instance for High Throughput
Targets 1,485+ tokens/sec processing capability
"""

import asyncio
import json
import logging
import time
import threading
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict
import mlx.core as mx
import mlx.nn as nn
from mlx_lm import load, generate
import numpy as np
from aiohttp import web, ClientSession
import gc
import psutil
from concurrent.futures import ThreadPoolExecutor
import torch

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class ProcessingMetrics:
    """Metrics for processing performance tracking"""
    tokens_processed: int = 0
    processing_time: float = 0.0
    throughput_tokens_per_sec: float = 0.0
    requests_processed: int = 0
    average_response_time: float = 0.0
    memory_usage_mb: float = 0.0
    gpu_utilization: float = 0.0

class OptimizedMLXModel:
    """Optimized MLX model with performance enhancements"""
    
    def __init__(self, model_path: str, quantization: str = "q4"):
        self.model_path = model_path
        self.quantization = quantization
        self.model = None
        self.tokenizer = None
        self.metrics = ProcessingMetrics()
        self._load_model()
        self._setup_optimization()
    
    def _load_model(self):
        """Load model with optimized settings"""
        logger.info(f"Loading model from {self.model_path} with {self.quantization} quantization")
        
        # Load model with quantization for memory efficiency
        self.model, self.tokenizer = load(
            self.model_path,
            tokenizer_config={'trust_remote_code': True}
        )
        
        # Apply quantization if specified
        if self.quantization == "q4":
            # Apply Q4 quantization for 75% memory reduction
            self.model = self._apply_q4_quantization(self.model)
        
        logger.info("Model loaded successfully")
    
    def _apply_q4_quantization(self, model: nn.Module) -> nn.Module:
        """Apply Q4 quantization to reduce memory usage by 75%"""
        logger.info("Applying Q4 quantization for 75% memory reduction")
        
        # Quantize linear layers to 4-bit
        for name, module in model.named_modules():
            if isinstance(module, nn.Linear):
                # Quantize weights to 4-bit
                quantized_weight = mx.quantize(module.weight, bits=4)
                module.weight = quantized_weight
        
        return model
    
    def _setup_optimization(self):
        """Setup performance optimizations"""
        # Enable memory growth to avoid OOM
        mx.set_memory_growth(True)
        
        # Set optimal thread count for CPU operations
        cpu_count = psutil.cpu_count(logical=False) or 4
        mx.set_default_device(mx.cpu)
        
        # Setup thread pool for parallel processing
        self.executor = ThreadPoolExecutor(max_workers=cpu_count)
        
        logger.info(f"Optimization setup complete with {cpu_count} CPU threads")
    
    def generate_optimized(self, prompt: str, max_tokens: int = 2048, 
                        temperature: float = 0.7, top_p: float = 0.9) -> str:
        """Generate text with optimized performance"""
        start_time = time.time()
        
        try:
            # Tokenize input
            tokens = self.tokenizer.encode(prompt)
            input_length = len(tokens)
            
            # Generate with performance optimizations
            response = generate(
                self.model,
                self.tokenizer,
                prompt=prompt,
                max_tokens=max_tokens,
                temp=temperature,
                top_p=top_p,
                verbose=False
            )
            
            # Calculate metrics
            processing_time = time.time() - start_time
            output_tokens = len(self.tokenizer.encode(response))
            total_tokens = input_length + output_tokens
            throughput = total_tokens / processing_time
            
            # Update metrics
            self.metrics.tokens_processed += total_tokens
            self.metrics.processing_time += processing_time
            self.metrics.requests_processed += 1
            self.metrics.throughput_tokens_per_sec = throughput
            self.metrics.average_response_time = (
                (self.metrics.average_response_time * (self.metrics.requests_processed - 1) + processing_time) 
                / self.metrics.requests_processed
            )
            
            # Monitor memory usage
            memory_info = psutil.virtual_memory()
            self.metrics.memory_usage_mb = memory_info.used / (1024 * 1024)
            
            logger.debug(f"Generated {total_tokens} tokens in {processing_time:.2f}s "
                        f"({throughput:.0f} tokens/sec)")
            
            return response
            
        except Exception as e:
            logger.error(f"Generation error: {e}")
            raise
        
        finally:
            # Periodic garbage collection
            if self.metrics.requests_processed % 10 == 0:
                gc.collect()

class OptimizedMLXServer:
    """High-performance MLX server instance"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.model = None
        self.metrics = ProcessingMetrics()
        self.request_queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self.is_running = False
        self.background_tasks: List[asyncio.Task] = []
        
        # Performance optimization
        self.request_batch_size = config.get('request_batch_size', 4)
        self.batch_timeout = config.get('batch_timeout', 0.05)  # 50ms
        self.max_concurrent_requests = config.get('max_concurrent_requests', 8)
        self.semaphore = asyncio.Semaphore(self.max_concurrent_requests)
        
        # Load model
        self._load_model()
    
    def _load_model(self):
        """Load and initialize the MLX model"""
        model_config = self.config['model']
        model_path = model_config['path']
        quantization = model_config.get('quantization', 'q4')
        
        logger.info(f"Loading optimized MLX model from {model_path}")
        self.model = OptimizedMLXModel(model_path, quantization)
        logger.info("Model loaded successfully")
    
    async def start_background_processing(self):
        """Start background request processing"""
        self.is_running = True
        
        # Start batch processor
        batch_task = asyncio.create_task(self._batch_processor())
        self.background_tasks.append(batch_task)
        
        # Start metrics collector
        metrics_task = asyncio.create_task(self._metrics_collector())
        self.background_tasks.append(metrics_task)
        
        # Start memory optimizer
        memory_task = asyncio.create_task(self._memory_optimizer())
        self.background_tasks.append(memory_task)
        
        logger.info("Background processing started")
    
    async def _batch_processor(self):
        """Process requests in batches for improved throughput"""
        while self.is_running:
            try:
                batch = []
                deadline = time.time() + self.batch_timeout
                
                # Collect requests for batch
                while len(batch) < self.request_batch_size and time.time() < deadline:
                    try:
                        # Wait for request with timeout
                        timeout = max(0.001, deadline - time.time())
                        request_data = await asyncio.wait_for(
                            self.request_queue.get(), 
                            timeout=timeout
                        )
                        batch.append(request_data)
                    except asyncio.TimeoutError:
                        break
                
                # Process batch if we have requests
                if batch:
                    await self._process_batch(batch)
                
            except Exception as e:
                logger.error(f"Batch processor error: {e}")
                await asyncio.sleep(0.1)
    
    async def _process_batch(self, batch: List[Dict[str, Any]]):
        """Process a batch of requests concurrently"""
        try:
            # Create tasks for concurrent processing
            tasks = []
            for request_data in batch:
                task = asyncio.create_task(self._process_single_request(request_data))
                tasks.append(task)
            
            # Process all requests in parallel
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Handle results
            for i, result in enumerate(results):
                request_data = batch[i]
                if isinstance(result, Exception):
                    logger.error(f"Request failed: {result}")
                    if 'future' in request_data:
                        request_data['future'].set_exception(result)
                else:
                    if 'future' in request_data:
                        request_data['future'].set_result(result)
            
            logger.debug(f"Processed batch of {len(batch)} requests")
            
        except Exception as e:
            logger.error(f"Batch processing error: {e}")
    
    async def _process_single_request(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single request with optimization"""
        async with self.semaphore:
            try:
                start_time = time.time()
                
                # Extract request parameters
                prompt = request_data.get('prompt', '')
                max_tokens = request_data.get('max_tokens', 2048)
                temperature = request_data.get('temperature', 0.7)
                top_p = request_data.get('top_p', 0.9)
                
                # Generate response
                response_text = await asyncio.get_event_loop().run_in_executor(
                    self.model.executor,
                    self.model.generate_optimized,
                    prompt,
                    max_tokens,
                    temperature,
                    top_p
                )
                
                processing_time = time.time() - start_time
                
                # Build response
                response = {
                    'choices': [{
                        'text': response_text,
                        'index': 0,
                        'finish_reason': 'stop'
                    }],
                    'model': self.config['model']['path'],
                    'usage': {
                        'prompt_tokens': len(self.model.tokenizer.encode(prompt)),
                        'completion_tokens': len(self.model.tokenizer.encode(response_text)),
                        'total_tokens': len(self.model.tokenizer.encode(prompt + response_text))
                    },
                    'processing_time': processing_time,
                    'timestamp': time.time()
                }
                
                return response
                
            except Exception as e:
                logger.error(f"Request processing error: {e}")
                raise
    
    async def _metrics_collector(self):
        """Collect and log performance metrics"""
        while self.is_running:
            try:
                # Collect system metrics
                memory_info = psutil.virtual_memory()
                cpu_percent = psutil.cpu_percent(interval=1)
                
                # Update model metrics
                self.model.metrics.memory_usage_mb = memory_info.used / (1024 * 1024)
                
                # Log performance metrics
                logger.info(f"Performance: {self.model.metrics.throughput_tokens_per_sec:.0f} tokens/sec, "
                          f"Memory: {memory_info.percent:.1f}%, CPU: {cpu_percent:.1f}%, "
                          f"Queue: {self.request_queue.qsize()}/{self.request_queue.maxsize}")
                
                await asyncio.sleep(10)  # Log every 10 seconds
                
            except Exception as e:
                logger.error(f"Metrics collection error: {e}")
                await asyncio.sleep(5)
    
    async def _memory_optimizer(self):
        """Optimize memory usage"""
        while self.is_running:
            try:
                # Force garbage collection every 30 seconds
                gc.collect()
                
                # Monitor memory usage
                memory_info = psutil.virtual_memory()
                if memory_info.percent > 85:
                    logger.warning(f"High memory usage: {memory_info.percent}%")
                    # Reduce batch size under memory pressure
                    self.request_batch_size = max(1, self.request_batch_size - 1)
                    
                    # Clear request queue if too full
                    while self.request_queue.qsize() > self.request_queue.maxsize * 0.8:
                        try:
                            self.request_queue.get_nowait()
                        except:
                            break
                
                await asyncio.sleep(30)
                
            except Exception as e:
                logger.error(f"Memory optimization error: {e}")
                await asyncio.sleep(10)
    
    async def handle_completion(self, request: web.Request) -> web.Response:
        """Handle completion requests with optimization"""
        try:
            request_data = await request.json()
            
            # Create future for async response
            future = asyncio.Future()
            request_data['future'] = future
            
            # Add request to queue
            await self.request_queue.put(request_data)
            
            # Wait for processing
            response_data = await future
            
            # Add performance metadata
            response_data['_performance'] = {
                'instance_id': self.config.get('instance_id', 0),
                'queue_size': self.request_queue.qsize(),
                'batch_size': self.request_batch_size,
                'concurrent_limit': self.max_concurrent_requests,
                'model_metrics': asdict(self.model.metrics)
            }
            
            return web.json_response(response_data)
            
        except Exception as e:
            logger.error(f"Completion request error: {e}")
            return web.json_response(
                {'error': f'Internal server error: {str(e)}'}, 
                status=500
            )
    
    async def handle_health(self, request: web.Request) -> web.Response:
        """Health check endpoint"""
        try:
            health_status = {
                'status': 'healthy',
                'timestamp': time.time(),
                'instance_id': self.config.get('instance_id', 0),
                'metrics': asdict(self.model.metrics),
                'queue_status': {
                    'size': self.request_queue.qsize(),
                    'max_size': self.request_queue.maxsize,
                    'is_running': self.is_running
                },
                'performance': {
                    'throughput_tokens_per_sec': self.model.metrics.throughput_tokens_per_sec,
                    'average_response_time': self.model.metrics.average_response_time,
                    'memory_usage_mb': self.model.metrics.memory_usage_mb
                }
            }
            
            return web.json_response(health_status)
            
        except Exception as e:
            logger.error(f"Health check error: {e}")
            return web.json_response(
                {'status': 'unhealthy', 'error': str(e)}, 
                status=500
            )
    
    async def start_server(self):
        """Start the optimized MLX server"""
        # Start background processing
        await self.start_background_processing()
        
        # Create web application
        app = web.Application()
        
        # Add routes
        app.router.add_post('/v1/completions', self.handle_completion)
        app.router.add_get('/health', self.handle_health)
        
        # Store server reference
        app['mlx_server'] = self
        
        return app
    
    async def shutdown(self):
        """Graceful shutdown"""
        logger.info("Shutting down MLX server...")
        self.is_running = False
        
        # Cancel background tasks
        for task in self.background_tasks:
            task.cancel()
        
        # Wait for tasks to complete
        await asyncio.gather(*self.background_tasks, return_exceptions=True)
        
        logger.info("MLX server shutdown complete")

# Web application factory
async def create_optimized_mlx_server_app(config: Dict[str, Any]) -> web.Application:
    """Create optimized MLX server web application"""
    server = OptimizedMLXServer(config)
    return await server.start_server()

if __name__ == '__main__':
    # Configuration for optimized server
    config = {
        'model': {
            'path': '/Users/simo/Documents/trae_projects/vibethinker-code-execution/models/mixtral-8x7b-instruct-v0.1',
            'quantization': 'q4'
        },
        'instance_id': 0,
        'request_batch_size': 6,  # Increased batch size
        'batch_timeout': 0.03,    # Reduced timeout (30ms)
        'max_concurrent_requests': 12,  # Increased concurrency
        'port': 8080
    }
    
    # Run optimized server
    web.run_app(create_optimized_mlx_server_app(config), host='0.0.0.0', port=config['port'])