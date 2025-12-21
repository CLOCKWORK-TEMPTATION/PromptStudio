"""
Unit tests for DSPy worker hard-stop enforcement.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Callable

import pytest

from app.budget import BudgetLimitReason, BudgetUsage
from app.executor import CandidateResult, JobExecutor
from app.schemas import BudgetLimits, DatasetReference, JobPayload, PromptSignature
from app.worker import JobRunner


class SequenceExecutor(JobExecutor):
    """Executor that yields a fixed sequence of candidates."""

    def __init__(self, candidates: list[CandidateResult]) -> None:
        self._candidates = candidates

    async def iterate_candidates(self, job: JobPayload) -> AsyncIterator[CandidateResult]:
        for candidate in self._candidates:
            await asyncio.sleep(0)
            yield candidate


def _job_payload(budget: BudgetLimits) -> JobPayload:
    return JobPayload(
        job_id="job-1",
        prompt_signature=PromptSignature(
            name="prompt",
            version="v1",
            input_variables=["input"],
        ),
        instructions="Do the thing",
        dataset_ref=DatasetReference(uri="file://dataset.jsonl"),
        budget=budget,
    )


def _time_source(times: list[float]) -> Callable[[], float]:
    iterator = iter(times)

    def _next() -> float:
        return next(iterator)

    return _next


@pytest.mark.asyncio
async def test_hard_stop_on_calls_limit() -> None:
    candidates = [
        CandidateResult(score=0.1, prompt_text="a", usage=BudgetUsage(calls=1, tokens=10, usd=0.01)),
        CandidateResult(score=0.2, prompt_text="b", usage=BudgetUsage(calls=1, tokens=10, usd=0.01)),
        CandidateResult(score=0.3, prompt_text="c", usage=BudgetUsage(calls=1, tokens=10, usd=0.01)),
    ]
    budget = BudgetLimits(max_calls=2, max_tokens=100, max_usd=1.0, max_duration_seconds=10.0)
    runner = JobRunner(SequenceExecutor(candidates))

    outcome = await runner.run(_job_payload(budget))

    assert outcome.hard_stop is True
    assert outcome.hard_stop_reason == BudgetLimitReason.MAX_CALLS
    assert outcome.usage.calls == 2
    assert outcome.best_candidate is not None
    assert outcome.best_candidate.prompt_text == "b"


@pytest.mark.asyncio
async def test_hard_stop_on_tokens_limit() -> None:
    candidates = [
        CandidateResult(score=0.1, prompt_text="a", usage=BudgetUsage(calls=1, tokens=60, usd=0.01)),
        CandidateResult(score=0.2, prompt_text="b", usage=BudgetUsage(calls=1, tokens=60, usd=0.01)),
    ]
    budget = BudgetLimits(max_calls=10, max_tokens=100, max_usd=1.0, max_duration_seconds=10.0)
    runner = JobRunner(SequenceExecutor(candidates))

    outcome = await runner.run(_job_payload(budget))

    assert outcome.hard_stop is True
    assert outcome.hard_stop_reason == BudgetLimitReason.MAX_TOKENS
    assert outcome.usage.tokens == 120


@pytest.mark.asyncio
async def test_hard_stop_on_usd_limit() -> None:
    candidates = [
        CandidateResult(score=0.1, prompt_text="a", usage=BudgetUsage(calls=1, tokens=10, usd=0.6)),
        CandidateResult(score=0.2, prompt_text="b", usage=BudgetUsage(calls=1, tokens=10, usd=0.6)),
    ]
    budget = BudgetLimits(max_calls=10, max_tokens=100, max_usd=1.0, max_duration_seconds=10.0)
    runner = JobRunner(SequenceExecutor(candidates))

    outcome = await runner.run(_job_payload(budget))

    assert outcome.hard_stop is True
    assert outcome.hard_stop_reason == BudgetLimitReason.MAX_USD
    assert outcome.usage.usd == pytest.approx(1.2)


@pytest.mark.asyncio
async def test_hard_stop_on_duration_limit() -> None:
    candidates = [
        CandidateResult(score=0.1, prompt_text="a", usage=BudgetUsage(calls=1, tokens=10, usd=0.01)),
        CandidateResult(score=0.2, prompt_text="b", usage=BudgetUsage(calls=1, tokens=10, usd=0.01)),
    ]
    budget = BudgetLimits(max_calls=10, max_tokens=100, max_usd=1.0, max_duration_seconds=1.0)
    time_source = _time_source([0.0, 0.4, 1.2, 1.2])
    runner = JobRunner(SequenceExecutor(candidates), time_source=time_source)

    outcome = await runner.run(_job_payload(budget))

    assert outcome.hard_stop is True
    assert outcome.hard_stop_reason == BudgetLimitReason.MAX_DURATION
    assert outcome.usage.duration_seconds == pytest.approx(1.2)
