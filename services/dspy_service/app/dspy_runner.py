"""
DSPy Runner - Core optimization logic - Epic 1.2
"""

import os
import json
from typing import Optional, Any
import dspy
from dspy.teleprompt import BootstrapFewShot, COPRO

from .schemas import (
    CompileRequest,
    CompileResponse,
    OptimizedSnapshot,
    DemoExample,
    CostInfo,
    DiagnosticsInfo,
    FailureCase,
)


class TokenTracker:
    """Track token usage and costs"""

    def __init__(self):
        self.total_calls = 0
        self.total_tokens = 0
        self.input_tokens = 0
        self.output_tokens = 0

    def track(self, response: Any):
        """Track tokens from a response"""
        self.total_calls += 1
        if hasattr(response, 'usage'):
            usage = response.usage
            if hasattr(usage, 'total_tokens'):
                self.total_tokens += usage.total_tokens
            if hasattr(usage, 'prompt_tokens'):
                self.input_tokens += usage.prompt_tokens
            if hasattr(usage, 'completion_tokens'):
                self.output_tokens += usage.completion_tokens

    def estimate_cost(self, model: str = "gpt-4") -> float:
        """Estimate USD cost based on model pricing"""
        # Approximate pricing per 1K tokens
        pricing = {
            "gpt-4": {"input": 0.03, "output": 0.06},
            "gpt-4-turbo": {"input": 0.01, "output": 0.03},
            "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015},
        }

        model_key = model.lower()
        for key in pricing:
            if key in model_key:
                p = pricing[key]
                return (self.input_tokens / 1000 * p["input"] +
                        self.output_tokens / 1000 * p["output"])

        # Default estimate
        return self.total_tokens / 1000 * 0.02


class PromptOptimizationProgram(dspy.Module):
    """DSPy program for prompt optimization"""

    def __init__(self, system_prompt: str, developer_prompt: Optional[str] = None):
        super().__init__()
        self.system_prompt = system_prompt
        self.developer_prompt = developer_prompt
        self.generate = dspy.ChainOfThought("input -> output")

    def forward(self, input: str) -> dspy.Prediction:
        """Execute the prompt with input"""
        # Build context from system and developer prompts
        context = self.system_prompt
        if self.developer_prompt:
            context += f"\n\n{self.developer_prompt}"

        # Use the input directly
        full_input = f"{context}\n\nUser Input: {input}"

        return self.generate(input=full_input)


def create_metric_fn(metric_type: str):
    """Create a metric function based on type"""

    def exact_match_metric(example, pred, trace=None) -> bool:
        if not hasattr(example, 'expected_output') or not example.expected_output:
            return False
        expected = str(example.expected_output).strip().lower()
        actual = str(pred.output).strip().lower() if hasattr(pred, 'output') else ""
        return expected == actual

    def contains_metric(example, pred, trace=None) -> bool:
        if not hasattr(example, 'expected_output') or not example.expected_output:
            return False
        expected = str(example.expected_output).strip().lower()
        actual = str(pred.output).strip().lower() if hasattr(pred, 'output') else ""
        return expected in actual

    def json_valid_metric(example, pred, trace=None) -> bool:
        actual = str(pred.output) if hasattr(pred, 'output') else ""
        try:
            json.loads(actual)
            return True
        except:
            return False

    metrics = {
        "exact_match": exact_match_metric,
        "contains": contains_metric,
        "json_valid": json_valid_metric,
    }

    return metrics.get(metric_type, exact_match_metric)


def prepare_trainset(request: CompileRequest) -> list[dspy.Example]:
    """Convert dataset examples to DSPy format"""
    trainset = []

    for ex in request.dataset:
        # Flatten input variables to a single input string
        input_str = json.dumps(ex.input_variables) if isinstance(ex.input_variables, dict) else str(ex.input_variables)

        example = dspy.Example(
            input=input_str,
            expected_output=ex.expected_output or ""
        ).with_inputs("input")

        trainset.append(example)

    return trainset


def run_baseline_evaluation(
    program: PromptOptimizationProgram,
    trainset: list[dspy.Example],
    metric_fn
) -> tuple[float, list[FailureCase]]:
    """Run baseline evaluation and return score + failures"""
    passed = 0
    failures = []

    for i, example in enumerate(trainset):
        try:
            pred = program(input=example.input)
            if metric_fn(example, pred):
                passed += 1
            else:
                if len(failures) < 10:  # Keep top 10 failures
                    failures.append(FailureCase(
                        exampleId=str(i),
                        input={"raw": example.input},
                        expectedOutput=getattr(example, 'expected_output', None),
                        actualOutput=str(getattr(pred, 'output', '')),
                        reason="Metric check failed"
                    ))
        except Exception as e:
            if len(failures) < 10:
                failures.append(FailureCase(
                    exampleId=str(i),
                    input={"raw": example.input},
                    expectedOutput=getattr(example, 'expected_output', None),
                    actualOutput="",
                    reason=str(e)
                ))

    score = passed / len(trainset) if trainset else 0.0
    return score, failures


async def run_optimization(request: CompileRequest) -> CompileResponse:
    """Main optimization function"""

    # Configure DSPy LM
    model_string = request.model.providerModelString

    # Use LiteLLM for provider abstraction
    lm = dspy.LM(
        model=model_string,
        temperature=request.model.temperature or 0.7,
        max_tokens=request.model.maxTokens or 1024,
    )
    dspy.configure(lm=lm)

    # Initialize tracker
    tracker = TokenTracker()

    # Create base program
    base_program = PromptOptimizationProgram(
        system_prompt=request.basePromptSnapshot.system,
        developer_prompt=request.basePromptSnapshot.developer
    )

    # Prepare dataset
    trainset = prepare_trainset(request)

    # Get metric function
    metric_fn = create_metric_fn(request.metricType)

    # Run baseline evaluation
    baseline_score, baseline_failures = run_baseline_evaluation(
        base_program, trainset, metric_fn
    )

    # Choose optimizer
    optimizer_type = request.optimizer.type
    optimizer_params = request.optimizer.params or {}

    if optimizer_type == "bootstrap_fewshot":
        # Bootstrap few-shot optimizer
        max_bootstrapped = optimizer_params.get("max_bootstrapped_demos", 4)
        max_labeled = optimizer_params.get("max_labeled_demos", 4)

        optimizer = BootstrapFewShot(
            metric=metric_fn,
            max_bootstrapped_demos=max_bootstrapped,
            max_labeled_demos=max_labeled,
        )
    elif optimizer_type == "copro":
        # COPRO instruction optimizer
        depth = optimizer_params.get("depth", 3)
        breadth = optimizer_params.get("breadth", 5)

        optimizer = COPRO(
            metric=metric_fn,
            depth=depth,
            breadth=breadth,
        )
    else:
        raise ValueError(f"Unknown optimizer type: {optimizer_type}")

    # Run optimization
    try:
        optimized_program = optimizer.compile(
            base_program,
            trainset=trainset,
        )
    except Exception as e:
        # If optimization fails, return baseline with error
        return CompileResponse(
            optimizedPromptSnapshot=OptimizedSnapshot(
                system=request.basePromptSnapshot.system,
                developer=request.basePromptSnapshot.developer,
            ),
            dspyArtifactJson=json.dumps({"error": str(e)}),
            baselineScore=baseline_score,
            optimizedScore=baseline_score,
            delta=0.0,
            cost=CostInfo(
                calls=tracker.total_calls,
                tokens=tracker.total_tokens,
                usdEstimate=tracker.estimate_cost(model_string)
            ),
            diagnostics=DiagnosticsInfo(topFailureCases=baseline_failures)
        )

    # Evaluate optimized program
    optimized_score, optimized_failures = run_baseline_evaluation(
        optimized_program, trainset, metric_fn
    )

    # Extract optimized prompt components
    optimized_system = request.basePromptSnapshot.system
    demos = None

    # Extract demos if available (for bootstrap_fewshot)
    if hasattr(optimized_program, 'demos') and optimized_program.demos:
        demos = []
        for demo in optimized_program.demos:
            if hasattr(demo, 'input') and hasattr(demo, 'output'):
                demos.append(DemoExample(
                    input=str(demo.input),
                    output=str(demo.output)
                ))

    # For COPRO, extract the optimized instruction
    if optimizer_type == "copro" and hasattr(optimized_program, 'generate'):
        if hasattr(optimized_program.generate, 'extended_signature'):
            sig = optimized_program.generate.extended_signature
            if hasattr(sig, 'instructions'):
                optimized_system = str(sig.instructions)

    # Create artifact
    artifact = {
        "optimizer": optimizer_type,
        "baseline_score": baseline_score,
        "optimized_score": optimized_score,
        "num_demos": len(demos) if demos else 0,
    }

    return CompileResponse(
        optimizedPromptSnapshot=OptimizedSnapshot(
            system=optimized_system,
            developer=request.basePromptSnapshot.developer,
            demos=demos
        ),
        dspyArtifactJson=json.dumps(artifact),
        baselineScore=baseline_score,
        optimizedScore=optimized_score,
        delta=optimized_score - baseline_score,
        cost=CostInfo(
            calls=tracker.total_calls,
            tokens=tracker.total_tokens,
            usdEstimate=tracker.estimate_cost(model_string)
        ),
        diagnostics=DiagnosticsInfo(
            topFailureCases=optimized_failures if optimized_failures else baseline_failures
        )
    )
