"""
Run status tracking for DSPy worker jobs.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from .executor import CandidateResult
from .budget import BudgetLimitReason


class RunStatus(str, Enum):
    """Lifecycle states for a job run."""

    RUNNING = "running"
    COMPLETED = "completed"
    HARD_STOPPED = "hard_stopped"


@dataclass(slots=True)
class RunStatusRecord:
    """Persisted status record for a job run."""

    job_id: str
    status: RunStatus
    hard_stop_reason: BudgetLimitReason | None = None
    best_candidate: CandidateResult | None = None


class RunStatusStore:
    """Interface for persisting run status updates."""

    async def update(self, record: RunStatusRecord) -> None:
        raise NotImplementedError

    async def get(self, job_id: str) -> RunStatusRecord | None:
        raise NotImplementedError


class InMemoryRunStatusStore(RunStatusStore):
    """In-memory status store for local execution."""

    def __init__(self) -> None:
        self._records: dict[str, RunStatusRecord] = {}

    async def update(self, record: RunStatusRecord) -> None:
        self._records[record.job_id] = record

    async def get(self, job_id: str) -> RunStatusRecord | None:
        return self._records.get(job_id)
