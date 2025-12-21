"""
Queue worker implementation with hard-stop enforcement.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass

import structlog

from .budget import BudgetLimitReason, BudgetTracker, BudgetUsage
from .executor import CandidateResult, JobExecutor, StaticJobExecutor
from .metrics import MetricsRecorder
from .queue import QueueClient
from .schemas import JobPayload
from .storage import BestResultStore

logger = structlog.get_logger(__name__)


@dataclass(slots=True)
class JobRunOutcome:
    """Outcome of a job run with hard-stop context."""

    job_id: str
    duration_seconds: float
    usage: BudgetUsage
    hard_stop: bool
    hard_stop_reason: BudgetLimitReason | None
    best_candidate: CandidateResult | None


class JobRunner:
    """Executes optimization jobs while enforcing budgets."""

    def __init__(self, executor: JobExecutor) -> None:
        self._executor = executor

    async def run(self, job: JobPayload) -> JobRunOutcome:
        start_time = time.monotonic()
        budget_tracker = BudgetTracker(job.budget)
        best_store = BestResultStore()
        hard_stop_reason: BudgetLimitReason | None = None

        async for candidate in self._executor.iterate_candidates(job):
            best_store.save_if_better(candidate)
            budget_tracker.record_usage(candidate.usage)
            hard_stop_reason = budget_tracker.check_limits()
            if hard_stop_reason is not None:
                break

        duration_seconds = time.monotonic() - start_time
        hard_stop = hard_stop_reason is not None

        return JobRunOutcome(
            job_id=job.job_id,
            duration_seconds=duration_seconds,
            usage=budget_tracker.usage,
            hard_stop=hard_stop,
            hard_stop_reason=hard_stop_reason,
            best_candidate=best_store.best,
        )


class WorkerService:
    """Consumes jobs from the queue and records observability signals."""

    def __init__(self, queue_client: QueueClient, metrics: MetricsRecorder) -> None:
        self._queue_client = queue_client
        self._metrics = metrics
        self._runner = JobRunner(StaticJobExecutor())
        self._shutdown_event = asyncio.Event()

    async def run_forever(self) -> None:
        logger.info("worker_started")
        try:
            async for job in self._queue_client.iterate_jobs():
                if self._shutdown_event.is_set():
                    break
                await self._process_job(job)
        except asyncio.CancelledError:
            logger.info("worker_cancelled")
        finally:
            logger.info("worker_stopped")

    async def shutdown(self) -> None:
        self._shutdown_event.set()

    async def _process_job(self, job: JobPayload) -> None:
        logger.info(
            "job_received",
            job_id=job.job_id,
            prompt_signature=job.prompt_signature.model_dump(),
            dataset_ref=job.dataset_ref.model_dump(),
        )
        outcome = await self._runner.run(job)
        self._metrics.record_job(outcome.duration_seconds, outcome.usage, outcome.hard_stop)

        log_payload = {
            "job_id": outcome.job_id,
            "duration_seconds": outcome.duration_seconds,
            "usage_calls": outcome.usage.calls,
            "usage_tokens": outcome.usage.tokens,
            "usage_usd": outcome.usage.usd,
            "hard_stop": outcome.hard_stop,
            "hard_stop_reason": outcome.hard_stop_reason,
        }

        if outcome.best_candidate is not None:
            log_payload["best_score"] = outcome.best_candidate.score

        if outcome.hard_stop:
            logger.warning("job_hard_stop", **log_payload)
        else:
            logger.info("job_completed", **log_payload)
