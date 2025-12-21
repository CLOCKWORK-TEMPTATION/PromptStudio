"""
Budget tracking and hard-stop policy enforcement.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from .schemas import BudgetLimits


class BudgetLimitReason(str, Enum):
    """Reason for enforcing a hard stop."""

    MAX_CALLS = "max_calls"
    MAX_TOKENS = "max_tokens"
    MAX_USD = "max_usd"
    MAX_DURATION = "max_duration_seconds"


@dataclass(slots=True)
class BudgetUsage:
    """Aggregated usage for a job run."""

    calls: int = 0
    tokens: int = 0
    usd: float = 0.0
    duration_seconds: float = 0.0


class BudgetTracker:
    """Tracks usage against strict limits."""

    def __init__(self, limits: BudgetLimits) -> None:
        self._limits = limits
        self._usage = BudgetUsage()

    @property
    def usage(self) -> BudgetUsage:
        return self._usage

    def record_usage(self, usage: BudgetUsage) -> None:
        self._usage.calls += usage.calls
        self._usage.tokens += usage.tokens
        self._usage.usd += usage.usd

    def update_duration(self, duration_seconds: float) -> None:
        self._usage.duration_seconds = duration_seconds

    def check_limits(self) -> BudgetLimitReason | None:
        if self._usage.calls >= self._limits.max_calls:
            return BudgetLimitReason.MAX_CALLS
        if self._usage.tokens >= self._limits.max_tokens:
            return BudgetLimitReason.MAX_TOKENS
        if self._usage.usd >= self._limits.max_usd:
            return BudgetLimitReason.MAX_USD
        if self._usage.duration_seconds >= self._limits.max_duration_seconds:
            return BudgetLimitReason.MAX_DURATION
        return None
