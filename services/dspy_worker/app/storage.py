"""
In-memory best-result storage for job runs.
"""

from __future__ import annotations

from dataclasses import dataclass

from .executor import CandidateResult


@dataclass(slots=True)
class BestResultStore:
    """Tracks the best candidate result seen so far."""

    best: CandidateResult | None = None

    def save_if_better(self, candidate: CandidateResult) -> None:
        if self.best is None or candidate.score > self.best.score:
            self.best = candidate
