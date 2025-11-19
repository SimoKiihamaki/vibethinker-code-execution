import os
import json
import argparse
import dspy
try:
    from dspy.teleprompt import GEPA
except Exception:
    try:
        from dspy.teleprompt.gepa.gepa import GEPA
    except Exception:
        import dspy.teleprompt as _tp
        GEPA = getattr(_tp, 'GEPA')
try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None

class AnalyzeFileSignature(dspy.Signature):
    input_json = dspy.InputField(desc="Input for analyzeFile")
    output_json = dspy.OutputField(desc="JSON per schema")

class AnalyzeFileModule(dspy.Module):
    def __init__(self):
        super().__init__()
        self.predict = dspy.ChainOfThought(AnalyzeFileSignature)
    def forward(self, input_json: str):
        pred = self.predict(input_json=input_json)
        return pred.output_json

def metric(example, prediction, trace=None, pred_name=None, pred_trace=None):
    try:
        obj = json.loads(prediction)
    except Exception:
        return 0.0
    required = ["summary", "metrics", "findings", "actions"]
    missing = [k for k in required if k not in obj]
    if missing:
        return 0.5
    fields_ok = isinstance(obj.get("metrics"), dict) and isinstance(obj.get("findings"), list) and isinstance(obj.get("actions"), list)
    if not fields_ok:
        return 0.7
    return 1.0

def build_trainset():
    try:
        from scripts.datasets.mlx_trainset import get_trainset
        prompts = get_trainset()
    except Exception:
        prompts = [json.dumps({"file": f"src/file_{i}.ts", "mode": "concise"}) for i in range(5)]
    return [dspy.Example(input_json=p).with_inputs("input_json") for p in prompts]

def configure_student_lm():
    base_url = os.getenv("MLX_BASE_URL", "http://localhost:8000")
    model_name = os.getenv("MLX_MODEL", "lmstudio-community/Qwen3-VL-2B-Thinking-MLX-8bit")
    timeout_ms = int(os.getenv("MLX_TIMEOUT_MS", "60000"))

    try:
        import requests
        h = requests.get(f"{base_url.rstrip('/')}/health", timeout=5)
        if h.status_code != 200:
            print("MLX load balancer health check failed. Set MLX_BASE_URL or start MLX servers.")
            return False
    except Exception:
        print("MLX load balancer not reachable. Set MLX_BASE_URL or start MLX servers.")
        return False

    from types import SimpleNamespace

    class MLXStudentLM(dspy.BaseLM):
        def __init__(self, base_url: str, model: str, temperature: float, max_tokens: int, timeout_ms: int):
            super().__init__(model=model, model_type="chat", temperature=temperature, max_tokens=max_tokens)
            self.base_url = base_url.rstrip("/")
            self.timeout = timeout_ms / 1000.0
        def forward(self, prompt=None, messages=None, **kwargs):
            import requests
            max_tokens = kwargs.get("max_tokens", self.kwargs.get("max_tokens"))
            temperature = kwargs.get("temperature", self.kwargs.get("temperature"))
            # Use completions endpoint for robustness, constructing a prompt from messages if provided
            url = f"{self.base_url}/v1/completions"
            if messages is not None:
                # Construct simple prompt from last user message
                try:
                    last_user = next((m for m in reversed(messages) if m.get("role") == "user"), None)
                    combined = last_user.get("content", "") if last_user else (messages[-1].get("content", "") if messages else "")
                except Exception:
                    combined = prompt or ""
                payload = {
                    "model": self.model,
                    "prompt": combined,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "stream": False,
                }
            else:
                payload = {
                    "model": self.model,
                    "prompt": prompt or "",
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "stream": False,
                }
            r = requests.post(url, json=payload, timeout=self.timeout)
            r.raise_for_status()
            data = r.json()
            choices_json = data.get("choices", [])
            # Return as chat-style choice for DSPy adapters
            text = choices_json[0].get("text", "") if choices_json else ""
            choices = [SimpleNamespace(message=SimpleNamespace(content=text))]
            usage = data.get("usage", {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0})
            return SimpleNamespace(model=self.model, choices=choices, usage=usage)

    student = MLXStudentLM(base_url, model_name, temperature=1.0, max_tokens=4096, timeout_ms=timeout_ms)
    dspy.configure(lm=student)
    return True

def configure_reflection_lm():
    key = os.getenv("OPENAI_API_KEY") or os.getenv("openai_api_key")
    base = os.getenv("OPENAI_API_BASE") or "https://api.openai.com/v1"
    if key:
        return dspy.LM("openai/gpt-5.1", api_key=key, api_base=base, max_tokens=32000, temperature=1.0)
    return None

def run_gepa(auto_level: str):
    if load_dotenv:
        try:
            load_dotenv()
        except Exception:
            pass
    ok = configure_student_lm()
    if not ok:
        print("No student LM configured. Set OPENROUTER_API_KEY or configure dspy manually.")
        return
    program = AnalyzeFileModule()
    trainset = build_trainset()
    valset = trainset[:12]
    reflection = configure_reflection_lm()
    gepa = GEPA(
        metric=metric,
        auto_level=auto_level,
        track_stats=True,
        add_format_failure_as_feedback=True,
        reflection_lm=reflection,
        max_metric_calls=100,
        num_threads=1,
        reflection_minibatch_size=3,
    )
    compiled = gepa.compile(program, trainset=trainset, valset=valset)
    best = getattr(compiled, "detailed_results", None)
    if hasattr(compiled, "teleprompter") and hasattr(compiled.teleprompter, "program"):
        prog = compiled.teleprompter.program
        print(json.dumps({"status": "ok", "optimized_prompt": str(prog)}, ensure_ascii=False))
    elif best:
        print(json.dumps({"status": "ok", "results": str(best)}, ensure_ascii=False))
    else:
        print(json.dumps({"status": "ok"}))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--auto", default="light")
    args = parser.parse_args()
    run_gepa(args.auto)

if __name__ == "__main__":
    main()