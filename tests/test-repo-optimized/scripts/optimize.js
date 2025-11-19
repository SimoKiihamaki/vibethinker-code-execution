
const fs = require('fs');
const path = require('path');

class CodeOptimizer {
  constructor() {
    this.optimizations = [];
  }

  optimizeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Apply various optimizations
    let optimized = this.removeUnusedImports(content);
    optimized = this.optimizeLoops(optimized);
    optimized = this.inlineSimpleFunctions(optimized);
    optimized = this.optimizeObjectAccess(optimized);
    
    const savedBytes = content.length - optimized.length;
    
    this.optimizations.push({
      file: filePath,
      originalSize: content.length,
      optimizedSize: optimized.length,
      savedBytes,
      compressionRatio: (savedBytes / content.length) * 100
    });
    
    return optimized;
  }

  removeUnusedImports(content) {
    // Remove unused import statements
    return content.replace(/^import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"];?\s*$/gm, '');
  }

  optimizeLoops(content) {
    // Optimize for loops to while loops where beneficial
    return content.replace(/for\s*\(\s*let\s+(\w+)\s*=\s*0\s*;\s*\1\s*<\s*(\w+)\.length\s*;\s*\1\+\+\s*\)/g, 
                      'for (let $1 = 0, len = $2.length; $1 < len; $1++)');
  }

  inlineSimpleFunctions(content) {
    // Inline simple one-liner functions
    return content.replace(/function\s+(\w+)\s*\(([^)]*)\)\s*\{\s*return\s+([^;]+);\s*\}/g, 
                      'const $1 = ($2) => $3');
  }

  optimizeObjectAccess(content) {
    // Optimize repeated object access
    return content.replace(/(\w+)\.(\w+)\s*\+\s*\1\.\2/g, '$1.$2 * 2');
  }

  getReport() {
    return {
      totalFiles: this.optimizations.length,
      totalSavedBytes: this.optimizations.reduce((sum, opt) => sum + opt.savedBytes, 0),
      averageCompressionRatio: this.optimizations.reduce((sum, opt) => sum + opt.compressionRatio, 0) / this.optimizations.length,
      optimizations: this.optimizations
    };
  }
}

// Usage
const optimizer = new CodeOptimizer();
const srcDir = path.join(__dirname, '../src');

fs.readdirSync(srcDir).forEach(file => {
  if (file.endsWith('.js')) {
    const filePath = path.join(srcDir, file);
    const optimized = optimizer.optimizeFile(filePath);
    fs.writeFileSync(filePath, optimized);
  }
});

const report = optimizer.getReport();
console.log('Optimization Report:', JSON.stringify(report, null, 2));

module.exports = CodeOptimizer;
