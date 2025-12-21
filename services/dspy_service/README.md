# DSPy Optimization Service

A FastAPI-based service that provides DSPy-powered prompt optimization for PromptStudio.

## Overview

This service exposes a REST API for optimizing prompts using Stanford's DSPy framework. It supports:

- **BootstrapFewShot**: Automatically generates few-shot demonstrations
- **COPRO**: Optimizes prompt instructions

## Quick Start

### Prerequisites

- Python 3.10+
- OpenAI API key (or other LLM provider)

### Installation

```bash
cd services/dspy_service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Configuration

Create a `.env` file:

```env
OPENAI_API_KEY=your-api-key-here
DSPY_SERVICE_PORT=8000
```

### Running the Service

```bash
# Development mode with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or using the module directly
python -m app.main
```

### Docker

```bash
# Build
docker build -t dspy-service .

# Run
docker run -p 8000:8000 -e OPENAI_API_KEY=your-key dspy-service
```

## API Endpoints

### Health Check

```
GET /health
```

Returns service health status.

### Compile/Optimize

```
POST /compile
```

Request body:
```json
{
  "basePromptSnapshot": {
    "system": "You are a helpful assistant...",
    "developer": "Optional developer instructions",
    "user": "User prompt template with {{variables}}",
    "context": "Optional context"
  },
  "dataset": [
    {
      "input_variables": {"name": "Alice"},
      "expected_output": "Hello Alice!"
    }
  ],
  "model": {
    "providerModelString": "gpt-4",
    "temperature": 0.7,
    "maxTokens": 1024
  },
  "optimizer": {
    "type": "bootstrap_fewshot",
    "params": {
      "max_bootstrapped_demos": 4,
      "max_labeled_demos": 4
    }
  },
  "metricType": "exact_match",
  "budget": {
    "maxCalls": 100,
    "maxTokens": 100000,
    "maxUSD": 10
  }
}
```

Response:
```json
{
  "optimizedPromptSnapshot": {
    "system": "Optimized system prompt...",
    "developer": null,
    "demos": [
      {"input": "...", "output": "..."}
    ]
  },
  "dspyArtifactJson": "...",
  "baselineScore": 0.65,
  "optimizedScore": 0.82,
  "delta": 0.17,
  "cost": {
    "calls": 25,
    "tokens": 15000,
    "usdEstimate": 0.45
  },
  "diagnostics": {
    "topFailureCases": []
  }
}
```

## Optimizer Types

### BootstrapFewShot

Best for tasks where examples are available. Automatically selects and bootstraps effective few-shot demonstrations.

Parameters:
- `max_bootstrapped_demos`: Maximum bootstrapped examples (default: 4)
- `max_labeled_demos`: Maximum labeled examples (default: 4)

### COPRO

Best for optimizing instructions/system prompts. Uses LLM to iteratively improve prompt wording.

Parameters:
- `depth`: Search depth (default: 3)
- `breadth`: Search breadth (default: 5)

## Metrics

- `exact_match`: Output must exactly match expected
- `contains`: Output must contain expected
- `json_valid`: Output must be valid JSON

## Budget Limits

- `maxCalls`: Maximum LLM API calls
- `maxTokens`: Maximum total tokens
- `maxUSD`: Maximum estimated cost in USD

## Testing

```bash
pytest tests/
```

## Integration with PromptStudio

Set the following environment variable in your PromptStudio backend:

```env
DSPY_SERVICE_URL=http://localhost:8000
```

The TypeScript client in `DspyServiceClient.ts` handles communication with this service.
