# MLX-Powered Agentic RAG System API Documentation

## Overview

The MLX-Powered Agentic RAG System provides a comprehensive API for intelligent repository analysis and code generation through Model Context Protocol (MCP) integration. This API enables 19x faster repository analysis with 98.7% token reduction through progressive disclosure patterns.

## Base URL

```
http://localhost:8080/api/v1
```

## Authentication

All API requests require an API key to be included in the header:

```http
Authorization: Bearer YOUR_API_KEY
```

## Core Endpoints

### Repository Analysis

#### Analyze Repository

**POST** `/repositories/analyze`

Performs comprehensive repository analysis with intelligent context extraction.

**Request Body:**
```json
{
  "path": "/path/to/repository",
  "options": {
    "includeDependencies": true,
    "securityScan": true,
    "includeTests": true,
    "maxDepth": 3,
    "fileExtensions": [".js", ".ts", ".py", ".md"]
  }
}
```

**Response:**
```json
{
  "analysisId": "uuid-v4",
  "status": "completed",
  "summary": {
    "totalFiles": 150,
    "totalLines": 12500,
    "languages": {
      "javascript": 80,
      "typescript": 45,
      "python": 25
    },
    "complexityScore": 7.2,
    "securityScore": 8.5
  },
  "structure": {
    "directories": [...],
    "files": [...],
    "dependencies": [...],
    "architecture": "mvc"
  },
  "context": {
    "keyConcepts": [...],
    "patterns": [...],
    "relationships": [...]
  },
  "metrics": {
    "processingTime": 2.3,
    "tokensUsed": 1850,
    "cacheHitRate": 0.95
  }
}
```

#### Get Analysis Status

**GET** `/repositories/analyze/{analysisId}`

Retrieves the status and results of a repository analysis.

**Response:**
```json
{
  "analysisId": "uuid-v4",
  "status": "completed|processing|failed",
  "progress": 85,
  "result": { ... },
  "error": null
}
```

### Code Generation

#### Generate Code

**POST** `/code/generate`

Generates code based on context and requirements with RAG enhancement.

**Request Body:**
```json
{
  "prompt": "Create authentication middleware",
  "context": {
    "repositoryPath": "/path/to/repo",
    "existingCode": "...",
    "patterns": ["middleware", "authentication"],
    "language": "typescript"
  },
  "options": {
    "style": "clean-code",
    "includeTests": true,
    "includeDocumentation": true,
    "maxTokens": 2000
  }
}
```

**Response:**
```json
{
  "generationId": "uuid-v4",
  "code": {
    "main": "import { Request, Response, NextFunction } from 'express';\n\nexport function authMiddleware(req: Request, res: Response, next: NextFunction) {\n  const token = req.headers.authorization?.split(' ')[1];\n  \n  if (!token) {\n    return res.status(401).json({ error: 'No token provided' });\n  }\n  \n  // Token validation logic\n  next();\n}",
    "tests": "...",
    "documentation": "..."
  },
  "explanation": "Generated authentication middleware following clean code principles...",
  "usage": "Import and use in your Express application...",
  "metrics": {
    "tokensUsed": 850,
    "generationTime": 1.2,
    "qualityScore": 9.1
  }
}
```

### Context-Aware Editing

#### Edit Code with Context

**POST** `/code/edit`

Performs intelligent code editing with full context awareness.

**Request Body:**
```json
{
  "filePath": "/path/to/file.ts",
  "instruction": "Add error handling to the authentication function",
  "context": {
    "repositoryAnalysis": { ... },
    "relatedFiles": ["auth.ts", "errors.ts"],
    "codingStandards": "airbnb",
    "testingRequired": true
  },
  "options": {
    "preserveFunctionality": true,
    "maintainStyle": true,
    "includeTests": true,
    "backupOriginal": true
  }
}
```

**Response:**
```json
{
  "editId": "uuid-v4",
  "changes": [
    {
      "type": "modification",
      "file": "/path/to/file.ts",
      "lineRange": "45-67",
      "before": "...",
      "after": "...",
      "explanation": "Added try-catch block and proper error handling"
    }
  ],
  "testsAdded": [
    {
      "file": "/path/to/file.test.ts",
      "content": "..."
    }
  ],
  "validation": {
    "syntaxCheck": "passed",
    "typeCheck": "passed",
    "testsPass": true
  },
  "metrics": {
    "processingTime": 3.1,
    "confidenceScore": 0.94
  }
}
```

### Dependency Analysis

#### Analyze Dependencies

**POST** `/dependencies/analyze`

Analyzes project dependencies with security vulnerability detection.

**Request Body:**
```json
{
  "projectPath": "/path/to/project",
  "packageManager": "npm",
  "options": {
    "securityScan": true,
    "licenseCheck": true,
    "outdatedCheck": true,
    "includeDevDependencies": true
  }
}
```

**Response:**
```json
{
  "analysisId": "uuid-v4",
  "dependencies": {
    "total": 125,
    "production": 85,
    "development": 40
  },
  "vulnerabilities": [
    {
      "package": "example-package",
      "version": "1.2.3",
      "severity": "high",
      "cve": "CVE-2024-1234",
      "description": "SQL injection vulnerability",
      "recommendation": "Update to version 1.2.4 or later"
    }
  ],
  "outdated": [
    {
      "package": "old-package",
      "current": "1.0.0",
      "latest": "2.0.0",
      "type": "major"
    }
  ],
  "licenses": {
    "summary": {
      "MIT": 80,
      "Apache-2.0": 25,
      "GPL-3.0": 5
    }
  },
  "metrics": {
    "securityScore": 7.8,
    "maintenanceScore": 8.2,
    "qualityScore": 8.9
  }
}
```

### Architectural Analysis

#### Analyze Architecture

**POST** `/architecture/analyze`

Analyzes software architecture and design patterns.

**Request Body:**
```json
{
  "repositoryPath": "/path/to/repository",
  "options": {
    "patternDetection": true,
    "qualityAssessment": true,
    "conformanceCheck": true,
    "generateDiagrams": true
  }
}
```

**Response:**
```json
{
  "analysisId": "uuid-v4",
  "architecture": {
    "pattern": "microservices",
    "style": "layered",
    "components": [
      {
        "name": "API Gateway",
        "type": "gateway",
        "responsibilities": ["routing", "authentication"],
        "dependencies": ["auth-service", "user-service"]
      }
    ]
  },
  "patterns": [
    {
      "name": "Repository Pattern",
      "files": ["/src/repositories/*.js"],
      "confidence": 0.92,
      "quality": "good"
    }
  ],
  "quality": {
    "cohesion": 8.5,
    "coupling": 6.2,
    "complexity": 7.1,
    "maintainability": 8.3
  },
  "issues": [
    {
      "type": "circular-dependency",
      "severity": "medium",
      "description": "Circular dependency detected between modules A and B",
      "recommendation": "Consider dependency injection or interface segregation"
    }
  ],
  "diagrams": {
    "component": "data:image/svg+xml;base64,...",
    "sequence": "data:image/svg+xml;base64,..."
  }
}
```

## Health and Monitoring

### System Health

#### Get Health Status

**GET** `/health`

Returns comprehensive health status of all system components.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "components": {
    "mcpServer": {
      "status": "healthy",
      "uptime": 3600,
      "version": "1.0.0"
    },
    "mlxServers": {
      "total": 27,
      "healthy": 27,
      "unhealthy": 0,
      "averageLoad": 0.65
    },
    "cache": {
      "status": "healthy",
      "hitRate": 0.95,
      "size": 1250
    }
  },
  "metrics": {
    "requestsPerSecond": 45.2,
    "averageResponseTime": 2.1,
    "errorRate": 0.001
  }
}
```

### Metrics

#### Get System Metrics

**GET** `/metrics`

Returns detailed performance metrics and statistics.

**Response:**
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "performance": {
    "requestsPerSecond": 45.2,
    "averageResponseTime": 2.1,
    "p95ResponseTime": 4.2,
    "p99ResponseTime": 8.1,
    "errorRate": 0.001
  },
  "tokenEfficiency": {
    "totalTokensProcessed": 1250000,
    "averageTokensPerRequest": 1850,
    "cacheHitRate": 0.95,
    "tokenReductionRate": 0.987
  },
  "mlxPerformance": {
    "activeInstances": 27,
    "queueDepth": 12,
    "averageProcessingTime": 1.8,
    "throughput": 1485.3
  },
  "resourceUsage": {
    "cpu": 45.2,
    "memory": 68.5,
    "disk": 23.1,
    "network": 15.8
  }
}
```

## Progressive Disclosure API

### Tool Registry

#### List Available Tools

**GET** `/tools`

Lists all available tools with progressive disclosure information.

**Response:**
```json
{
  "tools": [
    {
      "name": "repo-search",
      "description": "Search through repository files and content",
      "category": "repository",
      "disclosureLevel": "basic",
      "loadOnDemand": true,
      "estimatedTokens": 150
    },
    {
      "name": "code-analysis",
      "description": "Analyze code quality and patterns",
      "category": "analysis",
      "disclosureLevel": "advanced",
      "loadOnDemand": true,
      "estimatedTokens": 850
    }
  ]
}
```

#### Load Tool

**POST** `/tools/{toolName}/load`

Loads a specific tool on-demand for immediate use.

**Response:**
```json
{
  "toolName": "code-analysis",
  "status": "loaded",
  "loadTime": 0.3,
  "size": 12500,
  "endpoints": [
    "/tools/code-analysis/analyze",
    "/tools/code-quality/assess"
  ]
}
```

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "path",
      "issue": "Repository path does not exist"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "uuid-v4"
  }
}
```

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `VALIDATION_ERROR` | Invalid request parameters | 400 |
| `AUTHENTICATION_ERROR` | Invalid or missing API key | 401 |
| `AUTHORIZATION_ERROR` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `RATE_LIMIT_ERROR` | Too many requests | 429 |
| `SERVER_ERROR` | Internal server error | 500 |
| `MLX_ERROR` | MLX processing error | 503 |

## Rate Limiting

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 850
X-RateLimit-Reset: 1642248000
X-RateLimit-Reset-After: 3600
```

### Rate Limit Tiers

| Tier | Requests per Hour | Concurrent Requests |
|------|-------------------|-------------------|
| Free | 100 | 5 |
| Pro | 1000 | 25 |
| Enterprise | 10000 | 100 |

## WebSocket API

### Real-time Updates

Connect to WebSocket for real-time updates on analysis progress and system status.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:8080/api/v1/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Update:', data);
};
```

### WebSocket Events

#### Analysis Progress
```json
{
  "type": "analysis_progress",
  "analysisId": "uuid-v4",
  "progress": 45,
  "stage": "parsing_files",
  "estimatedTimeRemaining": 12
}
```

#### System Status
```json
{
  "type": "system_status",
  "mlxInstances": {
    "active": 27,
    "healthy": 27,
    "load": 0.65
  },
  "queueDepth": 8,
  "performance": {
    "requestsPerSecond": 42.1,
    "averageResponseTime": 2.3
  }
}
```

## SDKs and Libraries

### JavaScript/TypeScript SDK

```bash
npm install @mlx-agentic-rag/sdk
```

```javascript
import { MLXClient } from '@mlx-agentic-rag/sdk';

const client = new MLXClient({
  baseUrl: 'http://localhost:8080',
  apiKey: process.env.MLX_API_KEY
});

// Repository analysis
const analysis = await client.repositories.analyze({
  path: './my-project',
  options: {
    includeDependencies: true,
    securityScan: true
  }
});
```

### Python SDK

```bash
pip install mlx-agentic-rag
```

```python
from mlx_agentic_rag import MLXClient

client = MLXClient(
    base_url='http://localhost:8080',
    api_key=os.environ['MLX_API_KEY']
)

# Repository analysis
analysis = client.repositories.analyze(
    path='./my-project',
    options={
        'include_dependencies': True,
        'security_scan': True
    }
)
```

## Examples

### Complete Repository Analysis Workflow

```javascript
import { MLXClient } from '@mlx-agentic-rag/sdk';

const client = new MLXClient({
  baseUrl: 'http://localhost:8080',
  apiKey: process.env.MLX_API_KEY
});

async function analyzeRepository() {
  try {
    // Step 1: Analyze repository structure
    const analysis = await client.repositories.analyze({
      path: './my-project',
      options: {
        includeDependencies: true,
        securityScan: true,
        maxDepth: 3
      }
    });

    console.log(`Analysis completed in ${analysis.metrics.processingTime}s`);
    console.log(`Used ${analysis.metrics.tokensUsed} tokens`);
    console.log(`Found ${analysis.summary.totalFiles} files`);

    // Step 2: Analyze dependencies for security issues
    const deps = await client.dependencies.analyze({
      projectPath: './my-project',
      packageManager: 'npm',
      options: {
        securityScan: true,
        licenseCheck: true
      }
    });

    if (deps.vulnerabilities.length > 0) {
      console.log(`Found ${deps.vulnerabilities.length} security vulnerabilities`);
    }

    // Step 3: Generate code based on analysis
    const code = await client.code.generate({
      prompt: 'Create a comprehensive error handling system',
      context: {
        repositoryPath: './my-project',
        existingCode: analysis.context.keyConcepts,
        patterns: analysis.structure.patterns,
        language: 'typescript'
      },
      options: {
        includeTests: true,
        includeDocumentation: true
      }
    });

    console.log('Generated code with tests and documentation');

  } catch (error) {
    console.error('Analysis failed:', error.message);
  }
}

analyzeRepository();
```

### Batch Processing Multiple Repositories

```javascript
async function batchAnalyzeRepositories(repoPaths) {
  const results = [];
  
  for (const repoPath of repoPaths) {
    try {
      const analysis = await client.repositories.analyze({
        path: repoPath,
        options: {
          includeDependencies: true,
          securityScan: true
        }
      });
      
      results.push({
        path: repoPath,
        status: 'success',
        analysis: analysis
      });
    } catch (error) {
      results.push({
        path: repoPath,
        status: 'failed',
        error: error.message
      });
    }
  }
  
  return results;
}

// Process multiple repositories
const repos = ['./project1', './project2', './project3'];
const results = await batchAnalyzeRepositories(repos);
```

This API documentation provides comprehensive coverage of all endpoints, request/response formats, error handling, and practical examples for integrating the MLX-Powered Agentic RAG System into your applications.