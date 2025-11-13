const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

/**
 * PostToolUse hook that updates context after successful tool execution
 * This hook maintains context freshness and ensures related files are updated
 */

class ContextUpdater {
  constructor() {
    this.contextFile = '.trae/context/updated-files.json';
    this.dependenciesFile = '.trae/context/dependencies.json';
  }

  async run({ tool, result, context }) {
    try {
      console.log('[update-context] Starting context update...');
      
      const startTime = Date.now();
      const updatedFiles = await this.gatherUpdatedFiles(context);
      const dependencyUpdates = await this.updateDependencies(updatedFiles);
      const contextRefresh = await this.refreshContext(tool, result, context);
      
      const duration = Date.now() - startTime;
      
      console.log(`[update-context] Context update completed in ${duration}ms`);
      console.log(`[update-context] Updated ${updatedFiles.length} files, refreshed ${dependencyUpdates.length} dependencies`);
      
      return {
        success: true,
        updatedFiles,
        dependencyUpdates,
        contextRefresh,
        duration
      };
    } catch (error) {
      console.error('[update-context] Error updating context:', error);
      return {
        success: false,
        error: error.message,
        partialResults: true
      };
    }
  }

  async gatherUpdatedFiles(context) {
    const updatedFiles = [];
    
    try {
      // Get git status to identify modified files
      const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
      const modifiedFiles = gitStatus
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.slice(3)); // Remove git status indicators
      
      for (const file of modifiedFiles) {
        try {
          const stats = await fs.stat(file);
          const content = await fs.readFile(file, 'utf8');
          
          updatedFiles.push({
            path: file,
            size: stats.size,
            lastModified: stats.mtime,
            lines: content.split('\n').length,
            hash: this.generateHash(content)
          });
        } catch (error) {
          console.warn(`[update-context] Could not read file ${file}:`, error.message);
        }
      }
      
      // Store updated files info
      await this.ensureDir(path.dirname(this.contextFile));
      await fs.writeFile(
        this.contextFile,
        JSON.stringify(updatedFiles, null, 2)
      );
      
    } catch (error) {
      console.warn('[update-context] Git not available, using file system approach');
      
      // Fallback: check recently modified files
      const recentFiles = await this.findRecentlyModifiedFiles();
      updatedFiles.push(...recentFiles);
    }
    
    return updatedFiles;
  }

  async updateDependencies(updatedFiles) {
    const dependencyUpdates = [];
    
    for (const file of updatedFiles) {
      try {
        const dependencies = await this.analyzeFileDependencies(file.path);
        const updates = await this.propagateChanges(file, dependencies);
        
        dependencyUpdates.push({
          file: file.path,
          dependencies: dependencies.length,
          updates: updates.length,
          affectedFiles: updates.map(u => u.file)
        });
        
      } catch (error) {
        console.warn(`[update-context] Could not update dependencies for ${file.path}:`, error.message);
      }
    }
    
    // Store dependency updates
    await this.ensureDir(path.dirname(this.dependenciesFile));
    await fs.writeFile(
      this.dependenciesFile,
      JSON.stringify(dependencyUpdates, null, 2)
    );
    
    return dependencyUpdates;
  }

  async refreshContext(tool, result, context) {
    const refreshActions = [];
    
    // Refresh import maps if package.json was modified
    if (context.updatedFiles?.some(f => f.path.includes('package.json'))) {
      refreshActions.push(await this.refreshImportMaps());
    }
    
    // Refresh type definitions if TypeScript files were modified
    if (context.updatedFiles?.some(f => f.path.endsWith('.ts') || f.path.endsWith('.tsx'))) {
      refreshActions.push(await this.refreshTypeDefinitions());
    }
    
    // Refresh documentation if README or docs were modified
    if (context.updatedFiles?.some(f => f.path.includes('README') || f.path.includes('docs'))) {
      refreshActions.push(await this.refreshDocumentation());
    }
    
    // Update tool registry if tool definitions changed
    if (tool.name === 'update-tool-registry' || context.toolRegistryUpdated) {
      refreshActions.push(await this.updateToolRegistry());
    }
    
    return refreshActions.filter(action => action && action.success);
  }

  async findRecentlyModifiedFiles() {
    const recentFiles = [];
    const commonExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.json', '.md'];
    
    try {
      // Simple recursive file search for recently modified files
      const searchDir = async (dir, depth = 0) => {
        if (depth > 3) return; // Limit search depth
        
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await searchDir(fullPath, depth + 1);
          } else if (entry.isFile() && commonExtensions.some(ext => entry.name.endsWith(ext))) {
            try {
              const stats = await fs.stat(fullPath);
              const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
              
              if (stats.mtime.getTime() > fiveMinutesAgo) {
                const content = await fs.readFile(fullPath, 'utf8');
                recentFiles.push({
                  path: fullPath,
                  size: stats.size,
                  lastModified: stats.mtime,
                  lines: content.split('\n').length,
                  hash: this.generateHash(content)
                });
              }
            } catch (error) {
              // Skip files we can't read
            }
          }
        }
      };
      
      await searchDir('.');
    } catch (error) {
      console.warn('[update-context] Could not search for recently modified files:', error.message);
    }
    
    return recentFiles;
  }

  async analyzeFileDependencies(filePath) {
    const dependencies = [];
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Simple dependency analysis
      const importRegex = /(?:import|require|from)\s+['"]([^'"]+)['"]/g;
      let match;
      
      while ((match = importRegex.exec(content)) !== null) {
        const dependency = match[1];
        if (dependency.startsWith('.') || dependency.startsWith('/')) {
          // Local dependency
          const resolvedPath = path.resolve(path.dirname(filePath), dependency);
          dependencies.push({
            type: 'local',
            path: resolvedPath,
            original: dependency
          });
        } else {
          // External dependency
          dependencies.push({
            type: 'external',
            package: dependency,
            original: dependency
          });
        }
      }
      
      // Check for component dependencies in React/Vue files
      if (filePath.endsWith('.jsx') || filePath.endsWith('.tsx') || filePath.endsWith('.vue')) {
        const componentRegex = /<([A-Z][a-zA-Z0-9]*)/g;
        while ((match = componentRegex.exec(content)) !== null) {
          dependencies.push({
            type: 'component',
            name: match[1],
            original: match[1]
          });
        }
      }
      
    } catch (error) {
      console.warn(`[update-context] Could not analyze dependencies for ${filePath}:`, error.message);
    }
    
    return dependencies;
  }

  async propagateChanges(changedFile, dependencies) {
    const updates = [];
    
    for (const dep of dependencies) {
      if (dep.type === 'local') {
        try {
          // Check if dependency file exists and might need updates
          const depExists = await this.fileExists(dep.path);
          if (depExists) {
            const depContent = await fs.readFile(dep.path, 'utf8');
            
            // Simple heuristic: if dependency imports the changed file, it might need updates
            if (depContent.includes(changedFile.path) || 
                depContent.includes(path.basename(changedFile.path, path.extname(changedFile.path)))) {
              
              updates.push({
                file: dep.path,
                reason: 'imports changed file',
                confidence: 'medium'
              });
            }
          }
        } catch (error) {
          console.warn(`[update-context] Could not check dependency ${dep.path}:`, error.message);
        }
      }
    }
    
    return updates;
  }

  async refreshImportMaps() {
    try {
      // Simple import map refresh logic
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const importMap = {
        imports: {},
        scopes: {}
      };
      
      // Generate basic import map from package.json
      if (packageJson.dependencies) {
        for (const [pkg, version] of Object.entries(packageJson.dependencies)) {
          importMap.imports[pkg] = `https://esm.sh/${pkg}@${version}`;
        }
      }
      
      await this.ensureDir('.trae/context');
      await fs.writeFile('.trae/context/import-map.json', JSON.stringify(importMap, null, 2));
      
      return {
        success: true,
        type: 'import-map',
        packages: Object.keys(packageJson.dependencies || {}).length
      };
    } catch (error) {
      return {
        success: false,
        type: 'import-map',
        error: error.message
      };
    }
  }

  async refreshTypeDefinitions() {
    try {
      // Simple type definition refresh
      const typeDefs = {
        lastUpdated: new Date().toISOString(),
        files: []
      };
      
      // Find TypeScript declaration files
      const findTypeFiles = async (dir, depth = 0) => {
        if (depth > 2) return;
        
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await findTypeFiles(fullPath, depth + 1);
          } else if (entry.isFile() && entry.name.endsWith('.d.ts')) {
            typeDefs.files.push(fullPath);
          }
        }
      };
      
      await findTypeFiles('.');
      
      await this.ensureDir('.trae/context');
      await fs.writeFile('.trae/context/type-definitions.json', JSON.stringify(typeDefs, null, 2));
      
      return {
        success: true,
        type: 'type-definitions',
        files: typeDefs.files.length
      };
    } catch (error) {
      return {
        success: false,
        type: 'type-definitions',
        error: error.message
      };
    }
  }

  async refreshDocumentation() {
    try {
      const docs = {
        lastUpdated: new Date().toISOString(),
        files: []
      };
      
      // Find documentation files
      const docPatterns = ['README*', 'CHANGELOG*', 'docs/**/*.md', '*.md'];
      
      for (const pattern of docPatterns) {
        try {
          const files = await this.glob(pattern);
          docs.files.push(...files);
        } catch (error) {
          // Pattern might not match
        }
      }
      
      await this.ensureDir('.trae/context');
      await fs.writeFile('.trae/context/documentation.json', JSON.stringify(docs, null, 2));
      
      return {
        success: true,
        type: 'documentation',
        files: docs.files.length
      };
    } catch (error) {
      return {
        success: false,
        type: 'documentation',
        error: error.message
      };
    }
  }

  async updateToolRegistry() {
    try {
      // Simple tool registry update
      const registry = {
        lastUpdated: new Date().toISOString(),
        tools: []
      };
      
      // This would integrate with the main tool registry
      // For now, just mark as updated
      
      return {
        success: true,
        type: 'tool-registry',
        tools: registry.tools.length
      };
    } catch (error) {
      return {
        success: false,
        type: 'tool-registry',
        error: error.message
      };
    }
  }

  async ensureDir(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async glob(pattern) {
    // Simple glob implementation
    const glob = require('glob');
    return new Promise((resolve, reject) => {
      glob(pattern, (err, files) => {
        if (err) reject(err);
        else resolve(files);
      });
    });
  }

  generateHash(content) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content).digest('hex');
  }
}

// Export for use as Claude Code hook
module.exports = {
  name: 'update-context',
  description: 'Updates context after successful tool execution',
  trigger: 'PostToolUse',
  run: async (context) => {
    const updater = new ContextUpdater();
    return await updater.run(context);
  }
};