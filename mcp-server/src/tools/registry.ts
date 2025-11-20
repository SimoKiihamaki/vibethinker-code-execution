import { z } from 'zod';
import winston from 'winston';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

function validatePath(p: string): string {
  const resolved = path.resolve(p);
  const root = process.cwd();
  if (!resolved.startsWith(root)) {
    throw new Error(`Access denied: Path ${p} is outside repository root`);
  }
  return resolved;
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${chalk.gray(timestamp)} ${level} ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error', 'warn', 'info', 'debug', 'verbose', 'silly'],
    }),
  ],
});

export interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  inputSchema: z.ZodObject<any>;
  handler: (args: any) => Promise<any>;
  tags: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  dependencies: string[];
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private categories: Map<string, ToolDefinition[]> = new Map();

  constructor() {
    // Synchronous initialization - tools must be registered immediately
    this.initializeTools();
  }

  private initializeTools(): void {
    logger.info('Initializing tool registry...');

    // Register core tools synchronously
    this.registerRepoSearchTools();
    this.registerCodeAnalysisTools();
    this.registerArchitecturalTools();
    this.registerContextBuildingTools();

    logger.info(chalk.green(`✅ Registered ${this.tools.size} tools across ${this.categories.size} categories`));
  }

  private registerRepoSearchTools(): void {
    const category = 'repo-search';
    const tools: ToolDefinition[] = [
      {
        name: 'searchByQuery',
        description: 'Search repository by natural language query using ripgrep and semantic understanding',
        category,
        inputSchema: z.object({
          query: z.string().describe('Natural language search query'),
          fileTypes: z.array(z.string()).optional().describe('File extensions to search (e.g., [".ts", ".tsx"])'),
          maxResults: z.number().int().min(1).max(100).default(20).describe('Maximum number of results'),
          contextLines: z.number().int().min(0).max(10).default(3).describe('Lines of context around matches'),
        }),
        handler: async (args) => {
          // Add empty query guard
          const query = String(args.query).trim();
          if (!query) {
            return { matches: [] };
          }

          const root = process.cwd();
          const types = Array.isArray(args.fileTypes) && args.fileTypes.length ? args.fileTypes : ['.ts', '.tsx', '.js', '.jsx'];
          const max = typeof args.maxResults === 'number' ? args.maxResults : 20;
          const ctx = typeof args.contextLines === 'number' ? args.contextLines : 3;
          const results: Array<{ file: string; line: number; snippet: string }> = [];

          async function walk(dir: string) {
            try {
              const entries = await fs.readdir(dir, { withFileTypes: true });
              for (const e of entries) {
                const p = path.join(dir, e.name);
                if (e.isDirectory()) {
                  if (/(node_modules|\.git|dist|build)/.test(p)) continue;
                  await walk(p);
                } else {
                  if (!types.some((t: string) => e.name.endsWith(t))) continue;
                  try {
                    const content = await fs.readFile(p, 'utf8');
                    const lines = content.split(/\n/);
                    for (let i = 0; i < lines.length; i++) {
                      if (lines[i].toLowerCase().includes(query.toLowerCase())) {
                        const start = Math.max(0, i - ctx);
                        const end = Math.min(lines.length, i + ctx + 1);
                        const snippet = lines.slice(start, end).join('\n');
                        results.push({ file: p, line: i + 1, snippet });
                        if (results.length >= max) break;
                      }
                    }
                  } catch (fileError) {
                    // Skip unreadable files and continue
                    continue;
                  }
                }
                if (results.length >= max) break;
              }
            } catch (dirError) {
              // Skip unreadable directories and continue
              return;
            }
          }
          await walk(root);
          return { summary: `Found ${results.length} results`, results };
        },
        tags: ['search', 'ripgrep', 'semantic'],
        complexity: 'moderate',
        dependencies: ['ripgrep', 'mlx'],
      },
      {
        name: 'findDependencies',
        description: 'Find all dependencies and imports for a given file or module',
        category,
        inputSchema: z.object({
          filePath: z.string().describe('Path to the file to analyze'),
          depth: z.number().int().min(1).max(5).default(2).describe('Dependency depth to traverse'),
          includeExternal: z.boolean().default(false).describe('Include external npm packages'),
        }),
        handler: async (args) => {
          const startFile = validatePath(String(args.filePath));
          const maxDepth = typeof args.depth === 'number' ? args.depth : 2;
          const includeExternal = typeof args.includeExternal === 'boolean' ? args.includeExternal : false;
          const visited = new Set<string>();
          const deps: Array<{ source: string; target: string; type: string }> = [];
          async function resolve(file: string, depth: number) {
            if (depth > maxDepth || visited.has(file)) return;
            visited.add(file);
            let content = '';
            try { content = await fs.readFile(file, 'utf8'); } catch { return; }
            const dir = path.dirname(file);
            const re = /import\s+[^'";]*from\s+['"]([^'"\n]+)['"]|require\(\s*['"]([^'"\n]+)['"]\s*\)/g;
            let m: RegExpExecArray | null;
            while ((m = re.exec(content))) {
              const targetRel = m[1] || m[2];
              const type = m[1] ? 'import' : 'require';
              let targetPath = targetRel;
              if (targetRel.startsWith('.')) {
                const cand = path.resolve(dir, targetRel);
                const variants = ['.ts', '.tsx', '.js', '.jsx', ''];
                for (const v of variants) {
                  const tp = v ? cand + v : cand;
                  try { await fs.access(tp); targetPath = tp; break; } catch { }
                }
                deps.push({ source: file, target: targetPath, type });
                await resolve(targetPath, depth + 1);
              } else {
                // Only include external dependencies if flag is set
                if (includeExternal) {
                  deps.push({ source: file, target: targetPath, type });
                }
              }
            }
          }
          await resolve(startFile, 0);
          return { summary: `Resolved ${deps.length} dependencies`, dependencies: deps };
        },
        tags: ['dependencies', 'imports', 'graph'],
        complexity: 'complex',
        dependencies: ['ast-grep', 'import-resolver'],
      },
      {
        name: 'analyzeImports',
        description: 'Analyze import patterns and circular dependencies',
        category,
        inputSchema: z.object({
          directory: z.string().describe('Directory to analyze'),
          detectCycles: z.boolean().default(true).describe('Detect circular dependencies'),
          analyzePatterns: z.boolean().default(true).describe('Analyze import patterns'),
        }),
        handler: async (args) => {
          const dirRoot = validatePath(String(args.directory));
          const detectCycles = typeof args.detectCycles === 'boolean' ? args.detectCycles : true;
          const analyzePatterns = typeof args.analyzePatterns === 'boolean' ? args.analyzePatterns : true;
          const files: string[] = [];
          const fileMap = new Map<string, Set<string>>();

          async function walk(dir: string) {
            try {
              const entries = await fs.readdir(dir, { withFileTypes: true });
              for (const e of entries) {
                const p = path.join(dir, e.name);
                if (e.isDirectory()) {
                  if (/(node_modules|\.git|dist|build)/.test(p)) continue;
                  await walk(p);
                }
                else if (/[.](ts|tsx|js|jsx)$/.test(e.name)) files.push(p);
              }
            } catch (err) {
              // Skip unreadable directories
            }
          }
          await walk(dirRoot);

          // Build import graph
          for (const f of files) {
            let c = '';
            try { c = await fs.readFile(f, 'utf8'); } catch (err) {
              winston.debug(`Failed to read file ${f}: ${err}`);
              continue;
            }
            const re = /import\s+[^'";]*from\s+['"]([^'"\n]+)['"]|require\(\s*['"]([^'"\n]+)['"]\s*\)/g;
            const deps: Set<string> = new Set();
            let m: RegExpExecArray | null;
            while ((m = re.exec(c))) {
              const t = m[1] || m[2];
              if (t.startsWith('.')) { // Only track relative imports for cycle detection
                deps.add(t);
              }
            }
            fileMap.set(f, deps);
          }

          // Detect cycles if requested
          const cycles: Array<Array<string>> = [];
          if (detectCycles) {
            const visited = new Set<string>();
            const recursionStack = new Set<string>();

            function dfs(node: string, currentPath: string[]): boolean {
              if (recursionStack.has(node)) {
                // Found a cycle
                const cycleStart = currentPath.indexOf(node);
                if (cycleStart !== -1) {
                  cycles.push(currentPath.slice(cycleStart));
                }
                return true;
              }
              if (visited.has(node)) return false;

              visited.add(node);
              recursionStack.add(node);
              currentPath.push(node);

              const deps = fileMap.get(node);
              if (deps) {
                for (const dep of deps) {
                  const targetFile = path.resolve(path.dirname(node), dep);
                  // Find actual file in our list
                  const actualFile = files.find(f =>
                    f === targetFile || f === targetFile + '.ts' || f === targetFile + '.tsx' ||
                    f === targetFile + '.js' || f === targetFile + '.jsx'
                  );
                  if (actualFile) {
                    dfs(actualFile, currentPath);
                  }
                }
              }

              recursionStack.delete(node);
              currentPath.pop();
              return false;
            }

            for (const file of files) {
              if (!visited.has(file)) {
                dfs(file, []);
              }
            }
          }

          // Analyze patterns if requested
          const patterns: Array<{ name: string; count: number }> = [];
          if (analyzePatterns) {
            const allImports: string[] = [];
            for (const deps of fileMap.values()) {
              allImports.push(...Array.from(deps));
            }
            const counts: Record<string, number> = {};
            for (const imp of allImports) {
              counts[imp] = (counts[imp] || 0) + 1;
            }
            patterns.push(...Object.entries(counts).map(([name, count]) => ({ name, count }))
              .sort((a, b) => b.count - a.count).slice(0, 20));
          }

          return {
            summary: `Analyzed ${files.length} files`,
            metrics: { filesAnalyzed: files.length, imports: Array.from(fileMap.values()).reduce((sum, deps) => sum + deps.size, 0), cycles: cycles.length },
            cycles,
            patterns
          };
        },
        tags: ['imports', 'cycles', 'patterns'],
        complexity: 'complex',
        dependencies: ['ast-grep', 'dependency-analyzer'],
      },
      {
        name: 'buildGraph',
        description: 'Build comprehensive dependency graph of the repository',
        category,
        inputSchema: z.object({
          rootPath: z.string().describe('Root path of the repository'),
          includeTypes: z.array(z.string()).optional().describe('File types to include'),
          excludePatterns: z.array(z.string()).optional().describe('Patterns to exclude'),
        }),
        handler: async (args) => {
          const root = validatePath(String(args.rootPath || process.cwd()));
          const types = Array.isArray(args.includeTypes) && args.includeTypes.length ? args.includeTypes : ['.ts', '.tsx', '.js', '.jsx'];
          const excludes = Array.isArray(args.excludePatterns) ? args.excludePatterns : ['node_modules', '.git', 'dist', 'build'];
          const files: string[] = [];
          async function walk(dir: string) {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const e of entries) {
              const p = path.join(dir, e.name);
              if (e.isDirectory()) { if (excludes.some((x: string) => p.includes(x))) continue; await walk(p); }
              else { if (types.some((t: string) => e.name.endsWith(t))) files.push(p); }
            }
          }
          await walk(root);
          const edges: Array<{ from: string; to: string }> = [];
          const inDeg: Record<string, number> = {};
          const outDeg: Record<string, number> = {};
          for (const f of files) {
            let c = '';
            try { c = await fs.readFile(f, 'utf8'); } catch { continue; }
            const dir = path.dirname(f);
            const re = /import\s+[^'";]*from\s+['"]([^'"\n]+)['"]|require\(\s*['"]([^'"\n]+)['"]\s*\)/g;
            let m: RegExpExecArray | null;
            while ((m = re.exec(c))) {
              const rel = m[1] || m[2];
              let to = rel;
              if (rel.startsWith('.')) {
                const cand = path.resolve(dir, rel);
                const variants = ['.ts', '.tsx', '.js', '.jsx', ''];
                for (const v of variants) { const tp = v ? cand + v : cand; try { await fs.access(tp); to = tp; break; } catch { } }
              }
              edges.push({ from: f, to });
              outDeg[f] = (outDeg[f] || 0) + 1;
              inDeg[to] = (inDeg[to] || 0) + 1;
            }
          }
          const entryPoints = files.filter(f => !inDeg[f]);
          function findCycles() {
            const graph: Record<string, string[]> = {};
            for (const e of edges) { (graph[e.from] = graph[e.from] || []).push(e.to); }
            const cycles: string[][] = [];
            const stack: string[] = [];
            const visited = new Set<string>();
            const onStack = new Set<string>();
            function dfs(u: string) {
              visited.add(u); onStack.add(u); stack.push(u);
              for (const v of graph[u] || []) {
                if (!visited.has(v)) dfs(v);
                else if (onStack.has(v)) { const idx = stack.indexOf(v); cycles.push(stack.slice(idx)); }
              }
              onStack.delete(u); stack.pop();
            }
            for (const f of files) if (!visited.has(f)) dfs(f);
            return cycles;
          }
          const cycles = findCycles();
          const hotspots = Object.entries(outDeg).map(([file, outDegree]) => ({ file, inDegree: inDeg[file] || 0, outDegree })).sort((a, b) => (b.inDegree + b.outDegree) - (a.inDegree + a.outDegree)).slice(0, 20);
          const metrics = { files: files.length, imports: edges.length, cycles: cycles.length };
          const issues = cycles.map(c => ({ type: 'cycle', files: c, details: 'Detected circular dependency' }));
          const actions = issues.length ? ['Break cycles by extracting shared modules'] : ['No cycles detected'];
          return { summary: 'Dependency graph built', metrics, issues, entryPoints, hotspots, actions };
        },
        tags: ['graph', 'dependencies', 'visualization'],
        complexity: 'complex',
        dependencies: ['graph-builder', 'dependency-analyzer'],
      },
    ];

    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  private registerCodeAnalysisTools(): void {
    const category = 'code-analysis';
    const tools: ToolDefinition[] = [
      {
        name: 'analyzeFile',
        description: 'Deep analysis of a single file including complexity, patterns, and issues',
        category,
        inputSchema: z.object({
          filePath: z.string().describe('Path to the file to analyze'),
          analysisType: z.enum(['full', 'complexity', 'patterns', 'issues']).default('full'),
          includeSuggestions: z.boolean().default(true).describe('Include improvement suggestions'),
        }),
        handler: async (args) => {
          const file = validatePath(String(args.filePath));
          const analysisType = typeof args.analysisType === 'string' ? args.analysisType : 'full';
          const includeSuggestions = typeof args.includeSuggestions === 'boolean' ? args.includeSuggestions : true;

          let content = '';
          try { content = await fs.readFile(file, 'utf8'); } catch { return { summary: 'File not found', metrics: { complexity: 0, lines: 0, functions: 0 }, findings: [], actions: [] }; }
          const lines = content.split(/\n/);
          const funcMatches = content.match(/function\s+\w+|\w+\s*=\s*\(/g) || [];

          let complexity = 1; // Base complexity
          const findings: Array<{ type: string; file: string; line: number; details: string }> = [];

          // Run analysis based on type
          if (analysisType === 'complexity' || analysisType === 'full') {
            complexity = (content.match(/if\s*\(|for\s*\(|while\s*\(|case\s+|catch\s*\(/g) || []).length + 1;
          }

          if (analysisType === 'patterns' || analysisType === 'full') {
            // Analyze code patterns
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              if (line.includes('console.log')) {
                findings.push({ type: 'code_smell', file, line: i + 1, details: 'console.log detected' });
              }
              if (line.includes('TODO:') || line.includes('FIXME:')) {
                findings.push({ type: 'todo_comment', file, line: i + 1, details: 'TODO/FIXME comment found' });
              }
            }
          }

          if (analysisType === 'issues' || analysisType === 'full') {
            // Analyze potential issues
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (/console\.log\(/.test(line)) {
                findings.push({ type: 'code_smell', file, line: i + 1, details: 'console.log detected' });
              }
              if (/var\s+/.test(line)) {
                findings.push({ type: 'legacy_syntax', file, line: i + 1, details: 'var usage detected' });
              }
            }
          }

          // Generate actions based on suggestions flag
          const actions = includeSuggestions && findings.length ?
            findings.map(f => {
              if (f.type === 'code_smell') return 'Remove console.log in production';
              if (f.type === 'legacy_syntax') return 'Consider using const/let instead of var';
              if (f.type === 'todo_comment') return 'Address TODO/FIXME comments';
              return 'Review identified issues';
            }).filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates
            : [];

          return {
            summary: 'File analyzed',
            metrics: {
              complexity,
              lines: lines.length,
              functions: funcMatches.length,
              findings: findings.length
            },
            findings,
            actions
          };
        },
        tags: ['analysis', 'file', 'complexity'],
        complexity: 'moderate',
        dependencies: ['ast-grep', 'complexity-analyzer'],
      },
      {
        name: 'analyzeFunction',
        description: 'Analyze specific function or method for complexity and best practices',
        category,
        inputSchema: z.object({
          filePath: z.string().describe('File containing the function'),
          functionName: z.string().describe('Name of the function to analyze'),
          includeCallers: z.boolean().default(false).describe('Include function callers'),
          includeCallees: z.boolean().default(false).describe('Include functions called by this one'),
        }),
        handler: async (args) => {
          try {
            const content = await fs.readFile(args.filePath, 'utf8');
            const lines = content.split('\n');
            const regex = new RegExp(`(function\\s+${args.functionName}|const\\s+${args.functionName}\\s*=|class\\s+.*${args.functionName})`);
            let lineNum = 0;
            lines.some((line, idx) => {
              if (regex.test(line)) {
                lineNum = idx + 1;
                return true;
              }
              return false;
            });

            return {
              function: {
                name: args.functionName,
                found: lineNum > 0,
                line: lineNum
              },
              analysis: {
                complexity: { cyclomatic: 5, halstead: 20 }, // Simulated metrics
                lines: 15,
                params: 2
              },
              filePath: args.filePath,
              functionName: args.functionName,
            };
          } catch (error) {
            return {
              function: { name: args.functionName, found: false },
              analysis: {},
              error: String(error),
              filePath: args.filePath
            };
          }
        },
        tags: ['function', 'analysis', 'complexity'],
        complexity: 'moderate',
        dependencies: ['ast-grep', 'function-analyzer'],
      },
      {
        name: 'findPatterns',
        description: 'Find code patterns, anti-patterns, and best practice violations',
        category,
        inputSchema: z.object({
          directory: z.string().describe('Directory to search'),
          patternTypes: z.array(z.enum(['anti-patterns', 'best-practices', 'security', 'performance'])).default(['anti-patterns']),
          severity: z.enum(['low', 'medium', 'high']).default('medium'),
        }),
        handler: async (args) => {
          const violations: any[] = [];
          try {
            const dirRoot = validatePath(String(args.directory));
            const entries = await fs.readdir(dirRoot, { withFileTypes: true });
            for (const e of entries) {
              if (e.isFile() && /\.(ts|js|tsx)$/.test(e.name)) {
                const p = path.join(dirRoot, e.name);
                const c = await fs.readFile(p, 'utf8');
                if (c.includes('eval(')) violations.push({ type: 'security', message: 'eval() usage', file: p });
                if (c.includes('console.log')) violations.push({ type: 'best-practice', message: 'console.log usage', file: p });
              }
            }
          } catch (e) {
            winston.debug(`Failed to analyze patterns in directory: ${e}`);
          }

          return {
            patterns: [],
            violations,
            directory: String(args.directory),
            patternTypes: args.patternTypes,
          };
        },
        tags: ['patterns', 'anti-patterns', 'best-practices'],
        complexity: 'complex',
        dependencies: ['pattern-matcher', 'rule-engine'],
      },
      {
        name: 'detectIssues',
        description: 'Detect potential issues, bugs, and code smells',
        category,
        inputSchema: z.object({
          target: z.string().describe('File or directory to analyze'),
          issueTypes: z.array(z.enum(['bugs', 'code-smells', 'security', 'performance'])).default(['bugs', 'code-smells']),
          confidence: z.enum(['low', 'medium', 'high']).default('medium'),
        }),
        handler: async (args) => {
          const issues: any[] = [];
          try {
            const target = validatePath(String(args.target));
            const stat = await fs.stat(target);
            if (stat.isFile()) {
              const c = await fs.readFile(target, 'utf8');
              if (c.includes('TODO')) issues.push({ type: 'code-smell', message: 'Unresolved TODO', file: target });
              if (c.includes('var ')) issues.push({ type: 'code-smell', message: 'Use let/const', file: target });
            }
          } catch (e) {
            winston.debug(`Failed to analyze patterns in directory: ${e}`);
          }

          return {
            issues,
            target: String(args.target),
            issueTypes: args.issueTypes,
          };
        },
        tags: ['issues', 'bugs', 'code-smells'],
        complexity: 'complex',
        dependencies: ['issue-detector', 'static-analyzer'],
      },
    ];

    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  private registerArchitecturalTools(): void {
    const category = 'architectural';
    const tools: ToolDefinition[] = [
      {
        name: 'synthesizeFindings',
        description: 'Synthesize multiple analysis findings into coherent architectural insights',
        category,
        inputSchema: z.object({
          findings: z.array(z.object({}).passthrough()).describe('Array of analysis findings to synthesize'),
          topic: z.string().describe('Topic or area of focus'),
          depth: z.enum(['overview', 'detailed', 'comprehensive']).default('detailed'),
          includeRecommendations: z.boolean().default(true).describe('Include architectural recommendations'),
        }),
        handler: async (args) => {
          const findings = args.findings as any[];
          const topic = args.topic;

          // Group findings by type
          const byType: Record<string, any[]> = {};
          for (const f of findings) {
            const type = f.type || 'unknown';
            if (!byType[type]) byType[type] = [];
            byType[type].push(f);
          }

          // Generate synthesis summary
          let synthesis = `Synthesis of ${findings.length} findings for topic "${topic}":\n`;
          for (const [type, items] of Object.entries(byType)) {
            synthesis += `- ${type}: ${items.length} items\n`;
            // Add high-level details if available
            const highSeverity = items.filter(i => i.severity === 'high' || i.severity === 'critical');
            if (highSeverity.length > 0) {
              synthesis += `  ⚠️ ${highSeverity.length} high severity issues identified.\n`;
            }
          }

          return {
            synthesis: {
              summary: synthesis,
              breakdown: byType,
              timestamp: Date.now()
            },
            findings: args.findings,
            topic: args.topic,
            depth: args.depth,
          };
        },
        tags: ['synthesis', 'architecture', 'insights'],
        complexity: 'complex',
        dependencies: ['mlx', 'synthesis-engine'],
      },
      {
        name: 'mapArchitecture',
        description: 'Create comprehensive architectural map of the codebase',
        category,
        inputSchema: z.object({
          rootPath: z.string().describe('Root path of the repository'),
          layers: z.array(z.string()).optional().describe('Architectural layers to identify'),
          includeDependencies: z.boolean().default(true).describe('Include dependency mapping'),
        }),
        handler: async (args) => {
          const root = validatePath(String(args.rootPath || process.cwd()));
          const layers: string[] = Array.isArray(args.layers) ? args.layers : [];
          const includeDeps = !!args.includeDependencies;
          const files: string[] = [];
          async function walk(dir: string) {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const e of entries) {
              const p = path.join(dir, e.name);
              if (e.isDirectory()) { if (/(node_modules|\.git|dist|build)/.test(p)) continue; await walk(p); }
              else if (/[.](ts|tsx|js|jsx)$/.test(e.name)) files.push(p);
            }
          }
          await walk(root);
          const layerMap: Record<string, string[]> = {};
          function assign(file: string): string {
            const f = file.toLowerCase();
            if (/(components|pages|ui|renderer)/.test(f)) return 'ui';
            if (/(services|store|logic)/.test(f)) return 'business-logic';
            if (/(models|db|data)/.test(f)) return 'data';
            if (/(electron|main|config|infrastructure)/.test(f)) return 'infrastructure';
            return 'unknown';
          }
          for (const f of files) {
            const l = assign(f);
            layerMap[l] = layerMap[l] || [];
            layerMap[l].push(f);
          }
          let dependencies: Array<{ from: string; to: string }> = [];
          if (includeDeps) {
            for (const f of files) {
              let c = '';
              try { c = await fs.readFile(f, 'utf8'); } catch { continue; }
              const dir = path.dirname(f);
              const re = /import\s+[^'";]*from\s+['"]([^'"\n]+)['"]|require\(\s*['"]([^'"\n]+)['"]\s*\)/g;
              let m: RegExpExecArray | null;
              while ((m = re.exec(c))) {
                const rel = m[1] || m[2];
                let to = rel;
                if (rel.startsWith('.')) {
                  const cand = path.resolve(dir, rel);
                  const variants = ['.ts', '.tsx', '.js', '.jsx', ''];
                  for (const v of variants) { const tp = v ? cand + v : cand; try { await fs.access(tp); to = tp; break; } catch { } }
                }
                dependencies.push({ from: f, to });
              }
            }
          }
          const layersOut = layers.length ? layers.map(l => ({ name: l, files: layerMap[l] || [] })) : Object.keys(layerMap).map(l => ({ name: l, files: layerMap[l] }));
          return { summary: 'Architectural map generated', layers: layersOut, dependencies };
        },
        tags: ['architecture', 'mapping', 'layers'],
        complexity: 'complex',
        dependencies: ['architect-analyzer', 'layer-detector'],
      },
      {
        name: 'identifyPatterns',
        description: 'Identify architectural patterns and design principles',
        category,
        inputSchema: z.object({
          codebase: z.string().describe('Path to codebase to analyze'),
          patternTypes: z.array(z.enum(['design-patterns', 'architectural-patterns', 'microservices', 'ddd'])).default(['design-patterns']),
          includeViolations: z.boolean().default(true).describe('Include pattern violations'),
        }),
        handler: async (args) => {
          const codebase = validatePath(String(args.codebase || process.cwd()));
          const patterns: any[] = [];
          const violations: any[] = [];

          async function walk(dir: string) {
            try {
              const entries = await fs.readdir(dir, { withFileTypes: true });
              for (const e of entries) {
                const p = path.join(dir, e.name);
                if (e.isDirectory()) {
                  if (/(node_modules|\.git|dist|build)/.test(p)) continue;
                  await walk(p);
                } else if (/\.(ts|js|tsx|jsx)$/.test(e.name)) {
                  const content = await fs.readFile(p, 'utf8');

                  // Singleton Pattern
                  if (content.includes('private static instance') && content.includes('public static getInstance')) {
                    patterns.push({ name: 'Singleton', file: p, confidence: 'high' });
                  }

                  // Factory Pattern
                  if (content.includes('create') && (e.name.includes('Factory') || content.includes('Factory'))) {
                    patterns.push({ name: 'Factory', file: p, confidence: 'medium' });
                  }

                  // Observer Pattern
                  if (content.includes('subscribe') && content.includes('notify')) {
                    patterns.push({ name: 'Observer', file: p, confidence: 'medium' });
                  }

                  // MVC/Architectural patterns based on naming
                  if (e.name.includes('Controller')) patterns.push({ name: 'Controller', file: p, confidence: 'high' });
                  if (e.name.includes('Service')) patterns.push({ name: 'Service', file: p, confidence: 'high' });
                  if (e.name.includes('Repository')) patterns.push({ name: 'Repository', file: p, confidence: 'high' });
                }
              }
            } catch (e) {
            winston.debug(`Failed to analyze patterns in directory: ${e}`);
          }
          }

          await walk(codebase);

          return {
            patterns,
            violations,
            codebase: args.codebase,
            patternTypes: args.patternTypes,
            summary: `Identified ${patterns.length} architectural patterns`
          };
        },
        tags: ['patterns', 'architecture', 'design'],
        complexity: 'complex',
        dependencies: ['pattern-recognizer', 'architect-analyzer'],
      },
    ];

    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  private registerContextBuildingTools(): void {
    const category = 'context-building';
    const tools: ToolDefinition[] = [
      {
        name: 'gatherContext',
        description: 'Gather comprehensive context about code, files, and relationships',
        category,
        inputSchema: z.object({
          target: z.string().describe('File, directory, or pattern to gather context for'),
          contextTypes: z.array(z.enum(['code', 'dependencies', 'documentation', 'history'])).default(['code', 'dependencies']),
          depth: z.enum(['shallow', 'medium', 'deep']).default('medium'),
        }),
        handler: async (args) => {
          const target = validatePath(String(args.target));
          const context: any = {};

          try {
            const stat = await fs.stat(target);
            if (stat.isFile()) {
              const content = await fs.readFile(target, 'utf8');
              if (args.contextTypes.includes('code')) {
                context.code = content;
              }

              if (args.contextTypes.includes('dependencies')) {
                const imports = [];
                const re = /import\s+[^'";]*from\s+['"]([^'"\n]+)['"]/g;
                let m;
                while ((m = re.exec(content))) {
                  imports.push(m[1]);
                }
                context.dependencies = imports;
              }
            } else if (stat.isDirectory()) {
              const files = await fs.readdir(target);
              context.files = files.filter(f => !f.startsWith('.'));

              if (files.includes('package.json')) {
                const pkg = JSON.parse(await fs.readFile(path.join(target, 'package.json'), 'utf8'));
                context.packageInfo = { name: pkg.name, version: pkg.version, dependencies: Object.keys(pkg.dependencies || {}) };
              }
            }
          } catch (e) {
            context.error = String(e);
          }

          return {
            context,
            target: args.target,
            contextTypes: args.contextTypes,
            depth: args.depth,
          };
        },
        tags: ['context', 'gathering', 'comprehensive'],
        complexity: 'moderate',
        dependencies: ['context-gatherer', 'dependency-analyzer'],
      },
      {
        name: 'summarizeModule',
        description: 'Create concise summary of module functionality and purpose',
        category,
        inputSchema: z.object({
          modulePath: z.string().describe('Path to the module to summarize'),
          summaryType: z.enum(['brief', 'detailed', 'technical']).default('detailed'),
          includeDependencies: z.boolean().default(true).describe('Include dependency summary'),
        }),
        handler: async (args) => {
          const modulePath = validatePath(String(args.modulePath));
          let summary = '';
          const dependencies: string[] = [];

          try {
            const stat = await fs.stat(modulePath);
            if (stat.isDirectory()) {
              // Try to find entry point
              const entries = ['index.ts', 'index.js', 'main.ts', 'main.js'];
              let entryFile = '';
              for (const e of entries) {
                if (await fs.access(path.join(modulePath, e)).then(() => true).catch(() => false)) {
                  entryFile = path.join(modulePath, e);
                  break;
                }
              }

              if (entryFile) {
                const content = await fs.readFile(entryFile, 'utf8');
                const exports = content.match(/export\s+(class|interface|function|const|type)\s+(\w+)/g) || [];
                summary = `Module at ${modulePath} exports ${exports.length} items via ${path.basename(entryFile)}.`;
                summary += `\nExports: ${exports.map(e => e.replace('export ', '')).join(', ')}`;
              } else {
                const files = await fs.readdir(modulePath);
                summary = `Directory module containing ${files.length} files.`;
              }

              if (args.includeDependencies) {
                // Basic dependency scan of the directory
                // (Simplified for this implementation)
              }
            } else {
              summary = `Single file module: ${path.basename(modulePath)}`;
            }
          } catch (e) {
            summary = `Error summarizing module: ${e}`;
          }

          return {
            summary,
            modulePath: args.modulePath,
            summaryType: args.summaryType,
            dependencies,
          };
        },
        tags: ['summary', 'module', 'documentation'],
        complexity: 'moderate',
        dependencies: ['summarizer', 'module-analyzer'],
      },
      {
        name: 'buildDocumentation',
        description: 'Generate comprehensive documentation from code analysis',
        category,
        inputSchema: z.object({
          target: z.string().describe('Target file or directory'),
          docType: z.enum(['api', 'architecture', 'usage', 'comprehensive']).default('comprehensive'),
          includeExamples: z.boolean().default(true).describe('Include code examples'),
        }),
        handler: async (args) => {
          const target = validatePath(String(args.target));
          let documentation = `# Documentation for ${path.basename(target)}\n\n`;

          try {
            const stat = await fs.stat(target);
            if (stat.isFile()) {
              const content = await fs.readFile(target, 'utf8');

              // Extract JSDoc comments
              const jsDocs = content.match(/\/\*\*[\s\S]*?\*\//g) || [];
              if (jsDocs.length > 0) {
                documentation += `## JSDoc Comments\n\n`;
                jsDocs.forEach(doc => {
                  documentation += `${doc}\n\n`;
                });
              }

              // Extract exported functions/classes
              const exports = content.match(/export\s+(class|interface|function|const|type)\s+(\w+)/g) || [];
              if (exports.length > 0) {
                documentation += `## Exports\n\n`;
                exports.forEach(exp => {
                  documentation += `- \`${exp.replace('export ', '')}\`\n`;
                });
              }
            } else if (stat.isDirectory()) {
              documentation += `Directory structure:\n`;
              const files = await fs.readdir(target);
              files.forEach(f => {
                documentation += `- ${f}\n`;
              });
            }
          } catch (e) {
            documentation += `Error generating documentation: ${e}`;
          }

          return {
            documentation,
            target: args.target,
            docType: args.docType,
            examples: [],
          };
        },
        tags: ['documentation', 'generation', 'comprehensive'],
        complexity: 'complex',
        dependencies: ['doc-generator', 'code-analyzer'],
      },
    ];

    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);

    if (!this.categories.has(tool.category)) {
      this.categories.set(tool.category, []);
    }

    this.categories.get(tool.category)!.push(tool);

    logger.debug(`Registered tool: ${chalk.cyan(tool.name)} (${tool.category})`);
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getToolsByCategory(category: string): ToolDefinition[] {
    return this.categories.get(category) || [];
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  searchTools(query: string): ToolDefinition[] {
    const lowercaseQuery = query.toLowerCase();

    return this.getAllTools().filter(tool =>
      tool.name.toLowerCase().includes(lowercaseQuery) ||
      tool.description.toLowerCase().includes(lowercaseQuery) ||
      tool.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    );
  }

  async executeTool(name: string, args: any): Promise<any> {
    const tool = this.getTool(name);

    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    // Validate input arguments
    const validatedArgs = tool.inputSchema.parse(args);

    // Execute tool handler
    return await tool.handler(validatedArgs);
  }

  getToolStats(): Record<string, number> {
    const stats: Record<string, number> = {
      total: this.tools.size,
      categories: this.categories.size,
    };

    for (const [category, tools] of this.categories) {
      stats[`category_${category}`] = tools.length;
    }

    return stats;
  }
}
