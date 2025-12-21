"""
Shared configuration for DSPy worker budgets.
"""

from __future__ import annotations

from dataclasses import dataclass
from os import getenv


def _get_int(name: str, default: int) -> int:
    value = getenv(name)
    return int(value) if value is not None else default


def _get_float(name: str, default: float) -> float:
    value = getenv(name)
    return float(value) if value is not None else default


@dataclass(frozen=True, slots=True)
class BudgetProfile:
    """Budget profile defaults for worker runs."""

    max_calls: int
    max_tokens: int
    max_usd: float
    max_duration_seconds: float


@dataclass(frozen=True, slots=True)
class BudgetProfiles:
    """Shared budget profiles for quick/deep runs."""

    quick: BudgetProfile
    deep: BudgetProfile

    @classmethod
    def from_env(cls) -> "BudgetProfiles":
        return cls(
            quick=BudgetProfile(
                max_calls=_get_int("DSPY_BUDGET_QUICK_MAX_CALLS", 50),
                max_tokens=_get_int("DSPY_BUDGET_QUICK_MAX_TOKENS", 50_000),
                max_usd=_get_float("DSPY_BUDGET_QUICK_MAX_USD", 5.0),
                max_duration_seconds=_get_float("DSPY_BUDGET_QUICK_MAX_DURATION_SECONDS", 60.0),
            ),
            deep=BudgetProfile(
                max_calls=_get_int("DSPY_BUDGET_DEEP_MAX_CALLS", 200),
                max_tokens=_get_int("DSPY_BUDGET_DEEP_MAX_TOKENS", 200_000),
                max_usd=_get_float("DSPY_BUDGET_DEEP_MAX_USD", 20.0),
                max_duration_seconds=_get_float("DSPY_BUDGET_DEEP_MAX_DURATION_SECONDS", 300.0),
            ),
        )
