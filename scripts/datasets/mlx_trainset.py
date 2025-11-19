import json

def build_analyze_file_prompt(sample):
    return (
        "You are VibeThinker, an expert code analysis AI.\n\n"
        "Identity: VibeThinker\n"
        "Mode: concise\n\n"
        "Output rules:\n"
        "- Output strictly valid JSON that parses with no trailing text\n"
        "- Do not use markdown, code fences, or explanations\n"
        "- Only include keys defined in the schema\n"
        "- Use double quotes for all keys and strings\n\n"
        "Task: analyzeFile\n"
        "Description: Deep analysis of a single file including complexity, patterns, and issues\n"
        "Category: code-analysis\n"
        "Complexity: moderate\n\n"
        f"Input:\n{json.dumps(sample, indent=2)}\n\n"
        "Schema:\n"
        "{\n"
        "  \"summary\": \"string\",\n"
        "  \"metrics\": { \"complexity\": \"number\", \"lines\": \"number\", \"functions\": \"number\" },\n"
        "  \"findings\": [ { \"type\": \"string\", \"file\": \"string\", \"line\": \"number\", \"details\": \"string\" } ],\n"
        "  \"actions\": [\"string\"]\n"
        "}\n\n"
        "Self-check:\n"
        "- Ensure the JSON parses and includes all required fields\n"
    )

def build_detect_issues_prompt(sample):
    return (
        "You are VibeThinker, an expert code analysis AI.\n\n"
        "Identity: VibeThinker\n"
        "Mode: concise\n\n"
        "Output rules:\n"
        "- Output strictly valid JSON that parses with no trailing text\n"
        "- Do not use markdown, code fences, or explanations\n"
        "- Only include keys defined in the schema\n"
        "- Use double quotes for all keys and strings\n\n"
        "Task: detectIssues\n"
        "Description: Detect potential issues, bugs, and code smells\n"
        "Category: code-analysis\n"
        "Complexity: complex\n\n"
        f"Input:\n{json.dumps(sample, indent=2)}\n\n"
        "Schema:\n"
        "{\n"
        "  \"summary\": \"string\",\n"
        "  \"metrics\": { \"issues\": \"number\", \"severityHigh\": \"number\", \"filesAffected\": \"number\" },\n"
        "  \"issues\": [ { \"type\": \"bug|code_smell|security|performance\", \"severity\": \"low|medium|high\", \"file\": \"string\", \"line\": \"number\", \"details\": \"string\" } ],\n"
        "  \"actions\": [\"string\"]\n"
        "}\n\n"
        "Self-check:\n"
        "- Ensure the JSON parses and includes all required fields\n"
    )

def build_summarize_module_prompt(sample):
    return (
        "You are VibeThinker, an expert code analysis AI.\n\n"
        "Identity: VibeThinker\n"
        "Mode: concise\n\n"
        "Output rules:\n"
        "- Output strictly valid JSON that parses with no trailing text\n"
        "- Do not use markdown, code fences, or explanations\n"
        "- Only include keys defined in the schema\n"
        "- Use double quotes for all keys and strings\n\n"
        "Task: summarizeModule\n"
        "Description: Create concise summary of module functionality and purpose\n"
        "Category: context-building\n"
        "Complexity: moderate\n\n"
        f"Input:\n{json.dumps(sample, indent=2)}\n\n"
        "Schema:\n"
        "{\n"
        "  \"summary\": \"string\",\n"
        "  \"exports\": [\"string\"],\n"
        "  \"dependencies\": [\"string\"],\n"
        "  \"entryPoints\": [\"string\"],\n"
        "  \"actions\": [\"string\"]\n"
        "}\n\n"
        "Self-check:\n"
        "- Ensure the JSON parses and includes all required fields\n"
    )

def get_trainset():
    samples = []
    # AnalyzeFile samples
    files = [
        {"file": "mcp-server/src/client.ts", "mode": "concise"},
        {"file": "mcp-server/src/orchestrator.ts", "mode": "concise"},
        {"file": "mlx-servers/load_balancer.py", "mode": "concise"},
        {"file": "mlx-servers/server_manager.py", "mode": "concise"},
        {"file": "mcp-server/servers/code-analysis/analyzeFile.ts", "mode": "concise"},
        {"file": "mcp-server/servers/code-analysis/detectIssues.ts", "mode": "concise"},
        {"file": "mcp-server/servers/code-analysis/findPatterns.ts", "mode": "concise"},
        {"file": "mcp-server/servers/code-analysis/analyzeFunction.ts", "mode": "concise"},
        {"file": "mcp-server/servers/context-building/gatherContext.ts", "mode": "concise"},
        {"file": "mcp-server/servers/context-building/buildDocumentation.ts", "mode": "concise"},
        {"file": "mcp-server/servers/context-building/summarizeModule.ts", "mode": "concise"},
        {"file": "mcp-server/servers/repo-search/searchByQuery.ts", "mode": "concise"},
        {"file": "mcp-server/servers/repo-search/findDependencies.ts", "mode": "concise"},
        {"file": "mcp-server/servers/repo-search/analyzeImports.ts", "mode": "concise"},
        {"file": "mcp-server/servers/repo-search/buildGraph.ts", "mode": "concise"},
        {"file": "mcp-server/servers/architectural/identifyPatterns.ts", "mode": "concise"},
        {"file": "mcp-server/servers/architectural/synthesizeFindings.ts", "mode": "concise"},
        {"file": "mcp-server/servers/architectural/mapArchitecture.ts", "mode": "concise"},
        {"file": "mcp-server/src/progressive-disclosure.ts", "mode": "concise"},
        {"file": "mlx-servers/optimized_mlx_server.py", "mode": "concise"},
        {"file": "scripts/convert_model.py", "mode": "concise"},
        {"file": "scripts/health_check.py", "mode": "concise"},
        {"file": "hooks/session-start.js", "mode": "concise"}
    ]
    for s in files:
        samples.append(build_analyze_file_prompt(s))

    # DetectIssues samples
    scopes = [
        {"scope": "mcp-server/src", "severity": "mixed"},
        {"scope": "mlx-servers", "severity": "high"},
        {"scope": "mcp-server/servers/context-building", "severity": "medium"},
        {"scope": "mcp-server/servers/repo-search", "severity": "low"},
        {"scope": "mcp-server/servers/architectural", "severity": "medium"},
        {"scope": "mcp-server/servers/code-analysis", "severity": "high"}
    ]
    for s in scopes:
        samples.append(build_detect_issues_prompt(s))

    # SummarizeModule samples
    modules = [
        {"module": "mcp-server/src/client.ts"},
        {"module": "mlx-servers/load_balancer.py"},
        {"module": "mcp-server/servers/context-building/summarizeModule.ts"},
        {"module": "mcp-server/servers/repo-search/buildGraph.ts"},
        {"module": "mcp-server/servers/architectural/synthesizeFindings.ts"},
        {"module": "mcp-server/servers/code-analysis/analyzeFunction.ts"}
    ]
    for m in modules:
        samples.append(build_summarize_module_prompt(m))

    # Additional prompts for other common tools, using the same output schema
    def build_generic_prompt(task, sample):
        return (
            "You are VibeThinker, an expert code analysis AI.\n\n"
            "Identity: VibeThinker\n"
            "Mode: concise\n\n"
            "Output rules:\n"
            "- Output strictly valid JSON that parses with no trailing text\n"
            "- Do not use markdown, code fences, or explanations\n"
            "- Only include keys defined in the schema\n"
            "- Use double quotes for all keys and strings\n\n"
            f"Task: {task}\n"
            "Description: Perform the requested analysis with clear findings and actions\n"
            "Category: mixed\n"
            "Complexity: moderate\n\n"
            f"Input:\n{json.dumps(sample, indent=2)}\n\n"
            "Schema:\n"
            "{\n"
            "  \"summary\": \"string\",\n"
            "  \"metrics\": { \"items\": \"number\", \"filesAffected\": \"number\" },\n"
            "  \"findings\": [ { \"type\": \"string\", \"file\": \"string\", \"line\": \"number\", \"details\": \"string\" } ],\n"
            "  \"actions\": [\"string\"]\n"
            "}\n\n"
            "Self-check:\n"
            "- Ensure the JSON parses and includes all required fields\n"
        )

    extra = [
        ("findPatterns", {"scope": "mcp-server/servers/code-analysis", "pattern": "anti-patterns"}),
        ("findPatterns", {"scope": "mlx-servers", "pattern": "performance"}),
        ("buildDocumentation", {"module": "mcp-server/src/client.ts", "style": "concise"}),
        ("buildDocumentation", {"module": "mlx-servers/load_balancer.py", "style": "detailed"}),
        ("gatherContext", {"paths": ["mcp-server/src", "mlx-servers"], "depth": 2}),
        ("gatherContext", {"paths": ["mcp-server/servers"], "depth": 1}),
        ("analyzeImports", {"path": "mcp-server/src", "recursive": True}),
        ("analyzeImports", {"path": "mlx-servers", "recursive": True}),
        ("buildGraph", {"path": "mcp-server/src", "type": "deps"}),
        ("buildGraph", {"path": "mcp-server/servers", "type": "modules"}),
        ("findDependencies", {"path": "mcp-server/src", "includeDev": True}),
        ("findDependencies", {"path": "mlx-servers", "includeDev": False}),
        ("searchByQuery", {"query": "generateCompletion", "path": "mcp-server"}),
        ("searchByQuery", {"query": "/v1/completions", "path": "mlx-servers"}),
        ("identifyPatterns", {"area": "error-handling", "path": "mcp-server/src"}),
        ("identifyPatterns", {"area": "load-balancing", "path": "mlx-servers"}),
        ("synthesizeFindings", {"topic": "MLX integration", "paths": ["mcp-server", "mlx-servers"]}),
        ("synthesizeFindings", {"topic": "prompt design", "paths": ["mcp-server/servers"]}),
        ("mapArchitecture", {"root": "mcp-server", "focus": "LLM client"}),
        ("mapArchitecture", {"root": "mlx-servers", "focus": "request flow"}),
    ]
    for task, sample in extra:
        samples.append(build_generic_prompt(task, sample))

    variants = []
    for depth in [1, 2, 3]:
        variants.append(build_generic_prompt("gatherContext", {"paths": ["mcp-server"], "depth": depth}))
    for sev in ["low", "medium", "high", "mixed"]:
        variants.append(build_detect_issues_prompt({"scope": "mcp-server/src", "severity": sev}))
    for q in ["axios", "zod", "p-queue", "load balancer", "teleprompt", "GEPA", "MLX", "OpenAI"]:
        variants.append(build_generic_prompt("searchByQuery", {"query": q, "path": ""}))
    for root in ["mcp-server", "mlx-servers"]:
        variants.append(build_generic_prompt("mapArchitecture", {"root": root, "focus": "dependencies"}))
    samples.extend(variants)

    if len(samples) < 72:
        need = 72 - len(samples)
        for i in range(need):
            samples.append(build_analyze_file_prompt({"file": f"mcp-server/servers/auto-{i}.ts", "mode": "concise"}))

    return samples