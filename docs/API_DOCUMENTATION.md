# Backend API Documentation

## 1. Authentication & Security

### REST API

All protected routes require a Bearer Token in the `Authorization` header:

```http
Authorization: Bearer <your_jwt_token>
```

### WebSocket

WebSocket connections must provide the token in the handshake auth object:

```javascript
const socket = io('http://localhost:3001', {
  auth: {
    token: 'your_jwt_token'
  }
});
```

## 2. Standard Responses

We use a standardized JSON response format for all API endpoints.

### Success Response

```json
{
  "success": true,
  "data": { ...Result Object... },
  "meta": { ...Pagination or Metadata... }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": [ ... ] // Optional detailed validation errors
  }
}
```

## 3. Validation

We use **Zod** for request validation. If validation fails, the server returns a `400 Bad Request` with `code: 'VALIDATION_ERROR'`.

**Example Validation Error:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "path": "body.email",
        "message": "Invalid email format",
        "code": "invalid_string"
      }
    ]
  }
}
```

## 4. Caching (Semantic Cache)

We implement Semantic Caching for prompt responses.

* **Hit:** Exact hash match or high cosine similarity (>0.85).
* **Miss:** No similar entry found; executes LLM call and caches result.

**Headers:**

* `X-Cache-Status`: `HIT` or `MISS` (if implemented in specific routes).

## 5. Environment Variables

Ensure your `.env` file includes:

* `JWT_SECRET`: For signing tokens.
* `REDIS_URL`: For caching/sessions.
* `DATABASE_URL`: Postgres connection.
* `VITE_API_URL` / `NEXT_PUBLIC_API_URL`: For frontend connection.

## 6. Enterprise Features (Phase 5)

### Multi-Tenancy

* **Header:** `X-Tenant-ID` (Optional, inferred from domain or user context).
* **Isolation:** logical separation at database level.

### RBAC (Role-Based Access Control)

* **Models:** `Role`, `Permission`, `UserRole`.
* **Default Roles:** `OWNER`, `ADMIN`, `EDITOR`, `VIEWER`.
* Check permissions via `RBACService`.

### Audit Logging

All sensitive actions (WRITE/DELETE) are automatically logged.
Query logs via: `GET /api/audit-logs`

### Security Headers

* `X-Content-Type-Options: nosniff`
* `X-Frame-Options: DENY`
* `Strict-Transport-Security` (in Production)
