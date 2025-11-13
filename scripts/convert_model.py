#!/usr/bin/env python3
"""
MLX Model Converter for VibeThinker
Converts models to MLX Q4 format for optimal performance
"""

import argparse
import logging
import os
import subprocess
import sys
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MLXModelConverter:
    """Converts models to MLX format with quantization"""
    
    def __init__(self, model_name: str, output_dir: str, quantization: str = "q4"):
        self.model_name = model_name
        self.output_dir = Path(output_dir)
        self.quantization = quantization
        
        # Ensure output directory exists
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def convert_model(self) -> bool:
        """Convert model to MLX format"""
        try:
            logger.info(f"Converting {self.model_name} to MLX {self.quantization} format...")
            
            # Build output path
            output_path = self.output_dir / f"vibethinker-1.5b-mlx-{self.quantization}"
            
            # Convert using mlx-lm
            cmd = [
                sys.executable, "-m", "mlx_lm.convert",
                "--hf-path", self.model_name,
                "--mlx-path", str(output_path),
                "-q", self.quantization,
            ]
            
            logger.info(f"Running command: {' '.join(cmd)}")
            
            # Execute conversion
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )
            
            if result.stdout:
                logger.info(f"Conversion output: {result.stdout}")
            
            if result.stderr:
                logger.warning(f"Conversion warnings: {result.stderr}")
            
            # Verify conversion
            if self.verify_conversion(output_path):
                logger.info(f"✅ Successfully converted model to {output_path}")
                return True
            else:
                logger.error("❌ Model conversion verification failed")
                return False
                
        except subprocess.CalledProcessError as e:
            logger.error(f"Model conversion failed: {e}")
            logger.error(f"Command output: {e.stdout}")
            logger.error(f"Command errors: {e.stderr}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error during conversion: {e}")
            return False
    
    def verify_conversion(self, model_path: Path) -> bool:
        """Verify that the model was converted successfully"""
        try:
            # Check if model files exist
            required_files = ["weights.npz", "config.json", "tokenizer.model"]
            
            for file in required_files:
                file_path = model_path / file
                if not file_path.exists():
                    logger.error(f"Missing required file: {file}")
                    return False
            
            # Check model size (should be significantly smaller with quantization)
            weights_file = model_path / "weights.npz"
            file_size_mb = weights_file.stat().st_size / (1024 * 1024)
            
            expected_size_mb = {
                "q4": 700,  # ~700MB for Q4
                "q8": 1400, # ~1.4GB for Q8
                "f16": 2800, # ~2.8GB for F16
            }
            
            expected = expected_size_mb.get(self.quantization, 700)
            
            if file_size_mb > expected * 1.2:  # Allow 20% tolerance
                logger.warning(f"Model file size ({file_size_mb:.1f}MB) is larger than expected ({expected}MB)")
            
            logger.info(f"Model verification passed. Size: {file_size_mb:.1f}MB")
            return True
            
        except Exception as e:
            logger.error(f"Model verification failed: {e}")
            return False
    
    def optimize_model(self) -> bool:
        """Apply additional optimizations to the converted model"""
        try:
            logger.info("Applying model optimizations...")
            
            model_path = self.output_dir / f"vibethinker-1.5b-mlx-{self.quantization}"
            
            # Optimize for Apple Silicon
            optimization_cmd = [
                sys.executable, "-c", f"""
import mlx.core as mx
import numpy as np
from pathlib import Path

# Load model weights
model_path = Path('{model_path}')
weights = mx.load(str(model_path / 'weights.npz'))

# Apply optimizations for Apple Silicon
optimized_weights = {{}}
for key, value in weights.items():
    # Convert to optimal format for M-series GPU
    if isinstance(value, mx.array):
        optimized_weights[key] = mx.astype(value, mx.float16)
    else:
        optimized_weights[key] = value

# Save optimized weights
mx.savez(str(model_path / 'weights_optimized.npz'), **optimized_weights)

# Backup original and replace
import shutil
shutil.move(str(model_path / 'weights.npz'), str(model_path / 'weights_backup.npz'))
shutil.move(str(model_path / 'weights_optimized.npz'), str(model_path / 'weights.npz'))

print("✅ Model optimization completed")
"""
            ]
            
            result = subprocess.run(
                optimization_cmd,
                capture_output=True,
                text=True,
                check=True
            )
            
            logger.info(f"Optimization output: {result.stdout}")
            return True
            
        except Exception as e:
            logger.error(f"Model optimization failed: {e}")
            return False

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Convert models to MLX format")
    parser.add_argument(
        "--model", 
        type=str, 
        default="microsoft/DialoGPT-medium",
        help="HuggingFace model name to convert"
    )
    parser.add_argument(
        "--output-dir", 
        type=str, 
        default="./models",
        help="Output directory for converted model"
    )
    parser.add_argument(
        "--quantization", 
        type=str, 
        choices=["q4", "q8", "f16"],
        default="q4",
        help="Quantization level (q4=4-bit, q8=8-bit, f16=16-bit)"
    )
    parser.add_argument(
        "--optimize", 
        action="store_true",
        help="Apply additional optimizations for Apple Silicon"
    )
    
    args = parser.parse_args()
    
    # Create converter
    converter = MLXModelConverter(
        model_name=args.model,
        output_dir=args.output_dir,
        quantization=args.quantization
    )
    
    # Convert model
    success = converter.convert_model()
    
    if success and args.optimize:
        success = converter.optimize_model()
    
    if success:
        logger.info("✅ Model conversion completed successfully")
        sys.exit(0)
    else:
        logger.error("❌ Model conversion failed")
        sys.exit(1)

if __name__ == "__main__":
    main()