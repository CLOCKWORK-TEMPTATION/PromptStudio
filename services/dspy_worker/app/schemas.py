"""
Pydantic schemas for DSPy Worker job protocol.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class PromptSignature(BaseModel):
    """Identifies a prompt contract and its input variables."""

    model_config = {"extra": "forbid"}

    name: str = Field(min_length=1, max_length=128)
    version: str = Field(min_length=1, max_length=64)
    input_variables: list[str] = Field(min_length=1)


class DatasetReference(BaseModel):
    """Pointer to a dataset location and split."""

    model_config = {"extra": "forbid"}

    uri: str = Field(min_length=1, max_length=1024)
    version: str | None = Field(default=None, max_length=64)
    split: str | None = Field(default=None, max_length=32)


class BudgetLimits(BaseModel):
    """Strict budget limits enforced by the worker."""

    model_config = {"extra": "forbid"}

    max_calls: int = Field(ge=1, le=10000)
    max_tokens: int = Field(ge=1, le=10_000_000)
    max_usd: float = Field(ge=0, le=10_000)


class JobPayload(BaseModel):
    """Queue payload for optimization jobs."""

    model_config = {"extra": "forbid"}

    job_id: str = Field(min_length=1, max_length=128)
    prompt_signature: PromptSignature
    instructions: str = Field(min_length=1, max_length=8000)
    dataset_ref: DatasetReference
    budget: BudgetLimits


class HealthResponse(BaseModel):
    """Health response for readiness checks."""

    status: str = Field(default="ok")


class VersionResponse(BaseModel):
    """Version response for service metadata."""

    service: str
    version: str
