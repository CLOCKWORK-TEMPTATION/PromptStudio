"""
DSPy Optimization Service - FastAPI Application - Epic 1.2
"""

import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .schemas import (
    CompileRequest,
    CompileResponse,
    HealthResponse,
)
from .dspy_runner import run_optimization

# Load environment variables
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    print("DSPy Service starting up...")

    # Verify required environment variables
    if not os.getenv("OPENAI_API_KEY"):
        print("Warning: OPENAI_API_KEY not set")

    yield

    # Shutdown
    print("DSPy Service shutting down...")


# Create FastAPI app
app = FastAPI(
    title="DSPy Optimization Service",
    description="DSPy-powered prompt optimization for PromptStudio",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    try:
        import dspy
        dspy_version = dspy.__version__ if hasattr(dspy, '__version__') else "unknown"
    except:
        dspy_version = "not installed"

    return HealthResponse(
        status="ok",
        version="1.0.0",
        dspy_version=dspy_version,
    )


@app.post("/compile", response_model=CompileResponse)
async def compile_prompt(request: CompileRequest):
    """
    Compile/optimize a prompt using DSPy.

    This endpoint accepts a base prompt, dataset, and optimizer configuration,
    then uses DSPy to optimize the prompt for better performance.
    """
    try:
        # Validate request
        if not request.dataset:
            raise HTTPException(
                status_code=400,
                detail="Dataset cannot be empty"
            )

        if len(request.dataset) < 2:
            raise HTTPException(
                status_code=400,
                detail="Dataset must have at least 2 examples"
            )

        # Check budget limits
        if request.budget:
            if request.budget.maxCalls and request.budget.maxCalls > 1000:
                raise HTTPException(
                    status_code=400,
                    detail="maxCalls cannot exceed 1000"
                )

            if request.budget.maxUSD and request.budget.maxUSD > 100:
                raise HTTPException(
                    status_code=400,
                    detail="maxUSD cannot exceed 100"
                )

        # Run optimization
        result = await run_optimization(request)

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Compilation error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Optimization failed: {str(e)}"
        )


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "DSPy Optimization Service",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("DSPY_SERVICE_PORT", "8000")),
        reload=True,
    )
