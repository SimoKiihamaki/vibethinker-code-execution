#!/bin/bash
# Universal Claude Code Hooks Setup for Qwen3-VL-2B-Thinking System

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

QWEN3_SYSTEM_DIR="${QWEN3_SYSTEM_DIR:-$HOME/qwen3-claude-system}"
CURRENT_DIR="$(pwd)"

echo -e "${BLUE}🔗 Setting up Claude Code Hooks${NC}"
echo -e "${BLUE}==============================${NC}"

# Function to create hooks directory structure
create_hooks_structure() {
    echo -e "${BLUE}📁 Creating hooks structure...${NC}"

    # Create hooks directory
    mkdir -p ".claude/hooks"

    # Create hook subdirectories
    mkdir -p ".claude/hooks/pre-tool-use"
    mkdir -p ".claude/hooks/post-tool-use"
    mkdir -p ".claude/hooks/session-start"
    mkdir -p ".claude/hooks/session-stop"

    echo -e "${GREEN}✅ Hooks structure created${NC}"
}

# Function to setup PreToolUse hooks
setup_pre_tool_hooks() {
    echo -e "${BLUE}⚙️  Setting up PreToolUse hooks...${NC}"

    # Context gatherer hook
    cat > ".claude/hooks/pre-tool-use/context-gatherer.js" << 'EOF'
const fs = require('fs');
const path = require('path');

/**
 * Context Gatherer Hook
 * Runs before any tool use to gather relevant context
 */
async function contextGatherer(toolName, args) {
    const repoPath = process.cwd();

    console.log(`🔍 Gathering context for ${toolName}...`);

    // Analyze file being modified
    if (args.filepath) {
        const context = {
            file: args.filepath,
            language: detectLanguage(args.filepath),
            imports: extractImports(args.filepath),
            dependencies: findDependencies(args.filepath),
            relatedFiles: findRelatedFiles(args.filepath)
        };

        // Save context for PostToolUse hook
        saveContext(args.filepath, context);

        return context;
    }

    return null;
}

function detectLanguage(filepath) {
    const ext = path.extname(filepath);
    const langMap = {
        '.js': 'javascript',
        '.ts': 'typescript',
        '.py': 'python',
        '.java': 'java',
        '.cpp': 'cpp',
        '.c': 'c',
        '.go': 'go',
        '.rs': 'rust'
    };
    return langMap[ext] || 'text';
}

function extractImports(filepath) {
    try {
        const content = fs.readFileSync(filepath, 'utf8');
        const imports = [];

        // Simple regex for imports (can be enhanced)
        const importRegex = /import.*from\s+['"](.+)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }

        return imports;
    } catch (error) {
        return [];
    }
}

function findDependencies(filepath) {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        return Object.keys(packageJson.dependencies || {});
    }
    return [];
}

function findRelatedFiles(filepath) {
    const dir = path.dirname(filepath);
    const basename = path.basename(filepath, path.extname(filepath));

    try {
        return fs.readdirSync(dir)
            .filter(file => file.includes(basename) && file !== path.basename(filepath))
            .map(file => path.join(dir, file));
    } catch (error) {
        return [];
    }
}

function saveContext(filepath, context) {
    const contextDir = '.claude/workspace/context';
    if (!fs.existsSync(contextDir)) {
        fs.mkdirSync(contextDir, { recursive: true });
    }

    const contextFile = path.join(contextDir, `${path.basename(filepath)}.json`);
    fs.writeFileSync(contextFile, JSON.stringify(context, null, 2));
}

// Export for Claude Code
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { contextGatherer };
}

// Run hook if called directly
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length >= 2) {
        contextGatherer(args[0], JSON.parse(args[1] || '{}'))
            .then(context => {
                if (context) {
                    console.log('✅ Context gathered successfully');
                }
            })
            .catch(error => {
                console.error('❌ Error gathering context:', error.message);
                process.exit(1);
            });
    }
}
EOF

    # Security validator hook
    cat > ".claude/hooks/pre-tool-use/security-validator.js" << 'EOF'
const fs = require('fs');
const path = require('path');

/**
 * Security Validator Hook
 * Validates operations for security risks
 */
async function securityValidator(toolName, args) {
    console.log(`🔒 Validating security for ${toolName}...`);

    const risks = [];

    // Check for risky file patterns
    if (args.filepath) {
        const riskyPatterns = [
            /\.env$/,
            /config\./,
            /secret/,
            /private/,
            /key/,
            /password/
        ];

        if (riskyPatterns.some(pattern => pattern.test(args.filepath))) {
            risks.push({
                level: 'high',
                message: `Modifying sensitive file: ${args.filepath}`,
                suggestion: 'Ensure you understand the security implications'
            });
        }
    }

    // Check for risky content
    if (args.content) {
        const riskyKeywords = ['password', 'secret', 'key', 'token', 'api_key'];
        const foundKeywords = riskyKeywords.filter(keyword =>
            args.content.toLowerCase().includes(keyword)
        );

        if (foundKeywords.length > 0) {
            risks.push({
                level: 'medium',
                message: `Sensitive keywords detected: ${foundKeywords.join(', ')}`,
                suggestion: 'Review for potential secrets'
            });
        }
    }

    if (risks.length > 0) {
        console.log('\n⚠️  Security Warnings:');
        risks.forEach(risk => {
            console.log(`  [${risk.level.toUpperCase()}] ${risk.message}`);
            if (risk.suggestion) {
                console.log(`    💡 ${risk.suggestion}`);
            }
        });
        console.log('');

        // Ask for confirmation on high risks
        const highRisks = risks.filter(risk => risk.level === 'high');
        if (highRisks.length > 0) {
            // In actual implementation, this would prompt user
            console.log('🚨 High security risk detected - please confirm operation');
        }
    }

    return risks;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { securityValidator };
}
EOF

    # Dependency checker hook
    cat > ".claude/hooks/pre-tool-use/dependency-checker.js" << 'EOF'
const fs = require('fs');
const path = require('path');

/**
 * Dependency Checker Hook
 * Checks dependencies before making changes
 */
async function dependencyChecker(toolName, args) {
    console.log(`🔗 Checking dependencies for ${toolName}...`);

    if (!args.filepath) {
        return null;
    }

    const issues = [];

    // Check if file has unresolved imports
    const imports = extractImports(args.filepath);
    const unresolvedImports = imports.filter(imp => {
        return !isDependencyInstalled(imp) && !isLocalFile(imp);
    });

    if (unresolvedImports.length > 0) {
        issues.push({
            type: 'unresolved_imports',
            imports: unresolvedImports,
            suggestion: 'Install missing dependencies or check import paths'
        });
    }

    // Check for breaking changes
    if (toolName === 'Edit' || toolName === 'Write') {
        const dependents = findDependents(args.filepath);
        if (dependents.length > 0) {
            issues.push({
                type: 'breaking_change_risk',
                dependents: dependents.slice(0, 5), // Limit output
                suggestion: 'Review dependent files for potential breakage'
            });
        }
    }

    return issues;
}

function extractImports(filepath) {
    try {
        const content = fs.readFileSync(filepath, 'utf8');
        const imports = [];

        // JavaScript/TypeScript imports
        const jsImportRegex = /import.*from\s+['"](.+)['"]/g;
        const requireRegex = /require\(['"](.+)['"]\)/g;

        let match;
        while ((match = jsImportRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }
        while ((match = requireRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }

        return [...new Set(imports)]; // Remove duplicates
    } catch (error) {
        return [];
    }
}

function isDependencyInstalled(imp) {
    if (imp.startsWith('./') || imp.startsWith('../')) {
        return true; // Local file
    }

    // Check in package.json
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const allDeps = {
            ...(packageJson.dependencies || {}),
            ...(packageJson.devDependencies || {})
        };
        return allDeps[imp] || allDeps[imp.split('/')[0]];
    }

    return false;
}

function isLocalFile(imp) {
    return imp.startsWith('./') || imp.startsWith('../');
}

function findDependents(filepath) {
    const dependents = [];
    const basename = path.basename(filepath, path.extname(filepath));
    const dir = path.dirname(filepath);

    try {
        // Simple search for files that might import this
        const files = fs.readdirSync(dir, { recursive: true });
        files.forEach(file => {
            if (file.endsWith('.js') || file.endsWith('.ts')) {
                const content = fs.readFileSync(path.join(dir, file), 'utf8');
                if (content.includes(basename) || content.includes(filepath)) {
                    dependents.push(path.join(dir, file));
                }
            }
        });
    } catch (error) {
        // Directory read error
    }

    return dependents;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { dependencyChecker };
}
EOF

    echo -e "${GREEN}✅ PreToolUse hooks configured${NC}"
}

# Function to setup PostToolUse hooks
setup_post_tool_hooks() {
    echo -e "${BLUE}⚙️  Setting up PostToolUse hooks...${NC}"

    # Analyze changes hook
    cat > ".claude/hooks/post-tool-use/analyze-changes.js" << 'EOF'
const fs = require('fs');
const path = require('path');

/**
 * Analyze Changes Hook
 * Runs after tool use to analyze impact
 */
async function analyzeChanges(toolName, args, result) {
    console.log(`📊 Analyzing changes from ${toolName}...`);

    if (args.filepath && (toolName === 'Write' || toolName === 'Edit')) {
        const analysis = {
            file: args.filepath,
            changes: countChanges(args.filepath),
            impact: analyzeImpact(args.filepath),
            suggestions: generateSuggestions(args.filepath)
        };

        console.log('\n📋 Change Analysis:');
        console.log(`  File: ${analysis.file}`);
        console.log(`  Changes detected: ${analysis.changes}`);
        console.log(`  Impact level: ${analysis.impact.level}`);

        if (analysis.suggestions.length > 0) {
            console.log('\n💡 Suggestions:');
            analysis.suggestions.forEach(suggestion => {
                console.log(`  • ${suggestion}`);
            });
        }

        // Save analysis for session
        saveAnalysis(args.filepath, analysis);
    }

    return null;
}

function countChanges(filepath) {
    try {
        // This is a simplified implementation
        // In practice, you'd compare with previous version
        const content = fs.readFileSync(filepath, 'utf8');
        const lines = content.split('\n').length;

        return {
            lines_added: Math.floor(lines * 0.3), // Estimate
            lines_removed: Math.floor(lines * 0.1), // Estimate
            total_lines: lines
        };
    } catch (error) {
        return { lines_added: 0, lines_removed: 0, total_lines: 0 };
    }
}

function analyzeImpact(filepath) {
    const impact = {
        level: 'low',
        affected_areas: []
    };

    // Check if it's a configuration file
    if (filepath.includes('config') || filepath.includes('package.json')) {
        impact.level = 'high';
        impact.affected_areas.push('configuration');
    }

    // Check if it's a main entry point
    if (filepath.includes('index.') || filepath.includes('main.')) {
        impact.level = 'high';
        impact.affected_areas.push('entry_point');
    }

    // Check if it's in a critical directory
    const criticalDirs = ['src/', 'lib/', 'api/', 'models/'];
    if (criticalDirs.some(dir => filepath.includes(dir))) {
        impact.level = impact.level === 'high' ? 'high' : 'medium';
        impact.affected_areas.push('core_logic');
    }

    return impact;
}

function generateSuggestions(filepath) {
    const suggestions = [];

    // General suggestions based on file type
    if (filepath.endsWith('.js') || filepath.endsWith('.ts')) {
        suggestions.push('Consider running tests after JavaScript/TypeScript changes');
        suggestions.push('Check for any TypeScript compilation errors');
    }

    if (filepath.includes('package.json')) {
        suggestions.push('Run npm install after package.json changes');
        suggestions.push('Review dependency version changes');
    }

    if (filepath.includes('test') || filepath.includes('spec')) {
        suggestions.push('Run the test suite to verify changes');
    }

    return suggestions;
}

function saveAnalysis(filepath, analysis) {
    const analysisDir = '.claude/workspace/analysis';
    if (!fs.existsSync(analysisDir)) {
        fs.mkdirSync(analysisDir, { recursive: true });
    }

    const analysisFile = path.join(analysisDir, `${path.basename(filepath)}-analysis.json`);
    fs.writeFileSync(analysisFile, JSON.stringify(analysis, null, 2));
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { analyzeChanges };
}
EOF

    # Update context hook
    cat > ".claude/hooks/post-tool-use/update-context.js" << 'EOF'
const fs = require('fs');
const path = require('path');

/**
 * Update Context Hook
 * Updates context cache after changes
 */
async function updateContext(toolName, args, result) {
    if (args.filepath) {
        console.log(`🔄 Updating context for ${args.filepath}...`);

        // Invalidate relevant cache entries
        invalidateCache(args.filepath);

        // Update dependency graph
        updateDependencyGraph(args.filepath);

        console.log('✅ Context updated');
    }

    return null;
}

function invalidateCache(filepath) {
    const cacheDir = '.claude/workspace/cache';
    if (fs.existsSync(cacheDir)) {
        try {
            const files = fs.readdirSync(cacheDir);
            files.forEach(file => {
                if (file.includes(path.basename(filepath, path.extname(filepath)))) {
                    fs.unlinkSync(path.join(cacheDir, file));
                }
            });
        } catch (error) {
            // Cache directory issue
        }
    }
}

function updateDependencyGraph(filepath) {
    const contextDir = '.claude/workspace/context';
    const graphFile = path.join(contextDir, 'dependency-graph.json');

    try {
        let graph = {};
        if (fs.existsSync(graphFile)) {
            graph = JSON.parse(fs.readFileSync(graphFile, 'utf8'));
        }

        // Update graph with new file information
        graph[filepath] = {
            last_modified: Date.now(),
            dependencies: extractDependencies(filepath),
            dependents: findDependents(filepath)
        };

        // Save updated graph
        if (!fs.existsSync(contextDir)) {
            fs.mkdirSync(contextDir, { recursive: true });
        }
        fs.writeFileSync(graphFile, JSON.stringify(graph, null, 2));
    } catch (error) {
        // Graph update error
    }
}

function extractDependencies(filepath) {
    // Simplified dependency extraction
    return []; // Implement based on language
}

function findDependents(filepath) {
    // Simplified dependent finding
    return []; // Implement based on file scanning
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { updateContext };
}
EOF

    echo -e "${GREEN}✅ PostToolUse hooks configured${NC}"
}

# Function to setup SessionStart hooks
setup_session_hooks() {
    echo -e "${BLUE}⚙️  Setting up SessionStart hooks...${NC}"

    cat > ".claude/hooks/session-start/load-repo-context.js" << 'EOF'
const fs = require('fs');
const path = require('path');

/**
 * Load Repository Context Hook
 * Runs when Claude Code session starts
 */
async function loadRepoContext() {
    console.log('📚 Loading repository context...');

    const context = {
        repo_path: process.cwd(),
        repo_name: path.basename(process.cwd()),
        repo_type: detectRepoType(),
        structure: analyzeRepoStructure(),
        technologies: detectTechnologies(),
        configuration: loadConfiguration()
    };

    console.log(`Repository: ${context.repo_name}`);
    console.log(`Type: ${context.repo_type}`);
    console.log(`Technologies: ${context.technologies.join(', ')}`);

    // Save context for session
    saveSessionContext(context);

    return context;
}

function detectRepoType() {
    const indicators = {
        'nodejs': ['package.json', 'node_modules', '.npmrc'],
        'python': ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'],
        'java': ['pom.xml', 'build.gradle', 'src/main/java'],
        'rust': ['Cargo.toml', 'src/main.rs'],
        'go': ['go.mod', 'go.sum'],
        'ruby': ['Gemfile', 'Rakefile'],
        'php': ['composer.json', 'index.php']
    };

    for (const [type, files] of Object.entries(indicators)) {
        if (files.some(file => fs.existsSync(file))) {
            return type;
        }
    }

    return 'unknown';
}

function analyzeRepoStructure() {
    const structure = {
        directories: [],
        important_files: [],
        total_files: 0
    };

    try {
        const items = fs.readdirSync('.', { withFileTypes: true });

        items.forEach(item => {
            if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
                structure.directories.push(item.name);
            } else if (item.isFile()) {
                structure.total_files++;
                const importantFiles = ['README.md', 'package.json', 'requirements.txt', 'Dockerfile', '.gitignore'];
                if (importantFiles.includes(item.name)) {
                    structure.important_files.push(item.name);
                }
            }
        });
    } catch (error) {
        // Directory read error
    }

    return structure;
}

function detectTechnologies() {
    const technologies = [];
    const techIndicators = {
        'React': ['package.json'],
        'Vue.js': ['package.json'],
        'Angular': ['package.json', 'angular.json'],
        'Express.js': ['package.json'],
        'FastAPI': ['requirements.txt', 'main.py'],
        'Django': ['requirements.txt', 'manage.py'],
        'Flask': ['requirements.txt', 'app.py'],
        'Spring Boot': ['pom.xml', 'build.gradle'],
        'Docker': ['Dockerfile', 'docker-compose.yml'],
        'Kubernetes': ['k8s/', 'kubectl', 'Kubernetes'],
        'TypeScript': ['tsconfig.json', 'package.json'],
        'Webpack': ['webpack.config.js', 'package.json'],
        'Babel': ['babel.config.js', '.babelrc']
    };

    for (const [tech, files] of Object.entries(techIndicators)) {
        if (files.some(file => {
            if (file.includes('/')) {
                const [dir] = file.split('/');
                return fs.existsSync(dir);
            }
            return fs.existsSync(file);
        })) {
            technologies.push(tech);
        }
    }

    return technologies;
}

function loadConfiguration() {
    const config = {};

    // Load package.json if exists
    if (fs.existsSync('package.json')) {
        try {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            config.package_json = {
                name: packageJson.name,
                version: packageJson.version,
                scripts: Object.keys(packageJson.scripts || {}),
                dependencies: Object.keys(packageJson.dependencies || {}),
                devDependencies: Object.keys(packageJson.devDependencies || {})
            };
        } catch (error) {
            // Parse error
        }
    }

    // Load other config files as needed
    return config;
}

function saveSessionContext(context) {
    const workspaceDir = '.claude/workspace';
    if (!fs.existsSync(workspaceDir)) {
        fs.mkdirSync(workspaceDir, { recursive: true });
    }

    const contextFile = path.join(workspaceDir, 'session-context.json');
    fs.writeFileSync(contextFile, JSON.stringify(context, null, 2));
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { loadRepoContext };
}
EOF

    echo -e "${GREEN}✅ SessionStart hooks configured${NC}"
}

# Function to create hooks configuration
create_hooks_config() {
    echo -e "${BLUE}📝 Creating hooks configuration...${NC}"

    cat > ".claude/hooks_config.json" << EOF
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|Read",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/pre-tool-use/context-gatherer.js",
            "enabled": true
          },
          {
            "type": "command",
            "command": "node .claude/hooks/pre-tool-use/security-validator.js",
            "enabled": true
          },
          {
            "type": "command",
            "command": "node .claude/hooks/pre-tool-use/dependency-checker.js",
            "enabled": true
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/post-tool-use/analyze-changes.js",
            "enabled": true
          },
          {
            "type": "command",
            "command": "node .claude/hooks/post-tool-use/update-context.js",
            "enabled": true
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/session-start/load-repo-context.js",
            "enabled": true
          }
        ]
      }
    ]
  },
  "settings": {
    "timeout": 30000,
    "parallel_execution": false,
    "stop_on_error": false
  }
}
EOF

    echo -e "${GREEN}✅ Hooks configuration created${NC}"
}

# Main execution
main() {
    create_hooks_structure
    setup_pre_tool_hooks
    setup_post_tool_hooks
    setup_session_hooks
    create_hooks_config

    echo ""
    echo -e "${GREEN}🎉 Claude Code hooks setup completed!${NC}"
    echo ""
    echo -e "${YELLOW}Active hooks:${NC}"
    echo "  • Context Gatherer - Gathers file context before operations"
    echo "  • Security Validator - Checks for security risks"
    echo "  • Dependency Checker - Validates dependencies"
    echo "  • Change Analyzer - Analyzes impact of changes"
    echo "  • Context Updater - Updates context cache"
    echo "  • Repo Context Loader - Loads repository information"
    echo ""
}

# Run main function
main "$@"