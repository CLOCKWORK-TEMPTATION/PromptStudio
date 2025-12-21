"""
Metrics collection for DSPy Worker jobs.
"""

from __future__ import annotations

from dataclasses import dataclass

from prometheus_client import Counter, Histogram

from .budget import BudgetLimitReason, BudgetUsage


@dataclass(slots=True)
class MetricsRecorder:
    """Prometheus metrics recorder."""

    job_duration_seconds: Histogram
    job_cost_usd: Histogram
    job_calls_total: Counter
    job_hard_stop_total: Counter
    job_hard_stop_reason_total: Counter

    @classmethod
    def create(cls) -> "MetricsRecorder":
        return cls(
            job_duration_seconds=Histogram(
                "dspy_worker_job_duration_seconds",
                "Duration of DSPy worker jobs in seconds",
                buckets=(0.1, 0.5, 1, 2, 5, 10, 30, 60, 120),
            ),
            job_cost_usd=Histogram(
                "dspy_worker_job_cost_usd",
                "Estimated USD cost per job",
                buckets=(0.0, 0.01, 0.05, 0.1, 0.5, 1, 5, 10, 50),
            ),
            job_calls_total=Counter(
                "dspy_worker_job_calls_total",
                "Total LLM calls executed by the worker",
            ),
            job_hard_stop_total=Counter(
                "dspy_worker_job_hard_stop_total",
                "Number of hard-stop events enforced by budget limits",
            ),
            job_hard_stop_reason_total=Counter(
                "dspy_worker_job_hard_stop_reason_total",
                "Hard-stop events by budget limit reason",
                labelnames=("reason",),
            ),
        )

    def record_job(
        self,
        duration_seconds: float,
        usage: BudgetUsage,
        hard_stop: bool,
        hard_stop_reason: BudgetLimitReason | None,
    ) -> None:
        self.job_duration_seconds.observe(duration_seconds)
        self.job_cost_usd.observe(usage.usd)
        self.job_calls_total.inc(usage.calls)
        if hard_stop:
            self.job_hard_stop_total.inc()
            if hard_stop_reason is not None:
                self.job_hard_stop_reason_total.labels(reason=hard_stop_reason.value).inc()
