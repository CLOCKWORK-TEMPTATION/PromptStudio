"""
Structured logging configuration for DSPy Worker.
"""

from __future__ import annotations

import logging
import os

import structlog


def configure_logging() -> None:
    """Configure structlog for JSON output with context vars."""
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()

    logging.basicConfig(level=log_level, format="%(message)s")

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=False,
    )
