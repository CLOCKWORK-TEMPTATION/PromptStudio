"""
Queue abstraction for worker consumption.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

from .schemas import JobPayload


class QueueClient:
    """Queue client protocol for job retrieval."""

    async def get_job(self) -> JobPayload:
        raise NotImplementedError

    async def iterate_jobs(self) -> AsyncIterator[JobPayload]:
        while True:
            yield await self.get_job()


class InMemoryQueueClient(QueueClient):
    """Simple in-memory queue for local execution."""

    def __init__(self) -> None:
        self._queue: asyncio.Queue[JobPayload] = asyncio.Queue()

    async def get_job(self) -> JobPayload:
        return await self._queue.get()

    async def enqueue(self, job: JobPayload) -> None:
        await self._queue.put(job)
