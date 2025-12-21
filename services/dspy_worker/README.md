# DSPy Worker Service

Async worker responsible for consuming optimization jobs from a queue and enforcing strict budget hard-stop policies.

## Endpoints

- `GET /health`
- `GET /version`

## Job Payload Protocol

```json
{
  "job_id": "job_123",
  "prompt_signature": {
    "name": "customer_support_reply",
    "version": "v1",
    "input_variables": ["customer_name", "issue"]
  },
  "instructions": "Rewrite responses to be concise and polite.",
  "dataset_ref": {
    "uri": "s3://datasets/support/v1.jsonl",
    "version": "2024-10-01",
    "split": "train"
  },
  "budget": {
    "max_calls": 100,
    "max_tokens": 100000,
    "max_usd": 10.0
  }
}
```

## Running Locally

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```
