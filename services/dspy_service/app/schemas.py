"""
Pydantic schemas for DSPy Service API - Epic 1.2
"""

from typing import Optional, Any
from pydantic import BaseModel, Field


class PromptSnapshot(BaseModel):
    """Base prompt snapshot structure"""
    system: str
    developer: Optional[str] = None
    user: str
    context: Optional[str] = None


class ModelConfig(BaseModel):
    """LLM model configuration"""
    providerModelString: str = Field(default="gpt-4")
    temperature: Optional[float] = Field(default=0.7)
    maxTokens: Optional[int] = Field(default=1024)


class OptimizerConfig(BaseModel):
    """Optimizer configuration"""
    type: str = Field(..., description="bootstrap_fewshot or copro")
    params: Optional[dict[str, Any]] = Field(default_factory=dict)


class BudgetConfig(BaseModel):
    """Budget constraints for optimization"""
    maxCalls: Optional[int] = Field(default=100)
    maxTokens: Optional[int] = Field(default=100000)
    maxUSD: Optional[float] = Field(default=10.0)


class DatasetExample(BaseModel):
    """Single dataset example"""
    input_variables: dict[str, Any]
    expected_output: Optional[str] = None


class CompileRequest(BaseModel):
    """Request body for /compile endpoint"""
    basePromptSnapshot: PromptSnapshot
    dataset: list[DatasetExample]
    model: ModelConfig
    optimizer: OptimizerConfig
    metricType: str = Field(
        default="exact_match",
        description="exact_match, contains, json_valid"
    )
    budget: Optional[BudgetConfig] = Field(default_factory=BudgetConfig)


class DemoExample(BaseModel):
    """Demo example for few-shot learning"""
    input: str
    output: str


class OptimizedSnapshot(BaseModel):
    """Optimized prompt snapshot"""
    system: str
    developer: Optional[str] = None
    demos: Optional[list[DemoExample]] = None


class CostInfo(BaseModel):
    """Cost tracking information"""
    calls: int = 0
    tokens: int = 0
    usdEstimate: float = 0.0


class FailureCase(BaseModel):
    """Single failure case for diagnostics"""
    exampleId: Optional[str] = None
    input: dict[str, Any]
    expectedOutput: Optional[str] = None
    actualOutput: str
    reason: str


class DiagnosticsInfo(BaseModel):
    """Diagnostics information"""
    topFailureCases: list[FailureCase] = Field(default_factory=list)


class CompileResponse(BaseModel):
    """Response body for /compile endpoint"""
    optimizedPromptSnapshot: OptimizedSnapshot
    dspyArtifactJson: str
    baselineScore: float
    optimizedScore: float
    delta: float
    cost: CostInfo
    diagnostics: DiagnosticsInfo


class HealthResponse(BaseModel):
    """Health check response"""
    status: str = "ok"
    version: str = "1.0.0"
    dspy_version: Optional[str] = None
