"""
Job executor interface and default stub implementation.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass

from .budget import BudgetUsage
from .schemas import JobPayload


@dataclass(slots=True)
class CandidateResult:
    """Single candidate result from optimization step."""

    score: float
    prompt_text: str
    usage: BudgetUsage


class JobExecutor:
    """Interface for job execution strategies."""

    async def iterate_candidates(self, job: JobPayload) -> AsyncIterator[CandidateResult]:
        raise NotImplementedError


class StaticJobExecutor(JobExecutor):
    """Deterministic executor placeholder for queue integration."""

    async def iterate_candidates(self, job: JobPayload) -> AsyncIterator[CandidateResult]:
        usage = BudgetUsage(calls=1, tokens=min(256, job.budget.max_tokens), usd=min(0.01, job.budget.max_usd))
        candidate = CandidateResult(
            score=0.0,
            prompt_text=job.instructions,
            usage=usage,
        )
        yield candidate
