# GoCheck API Documentation




## Authentication

Currently using simple organizer ID tracking (no complex auth). For MVP:
- Organizer actions require `organizerId` in request header or body
- Public bill access uses unique `shareLink` - no auth required
- Future: Consider JWT tokens or session-based auth

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human readable error message",
  "statusCode": 400
}
```

## Error Codes

| Code | Status | Meaning |
|------|--------|----------|
| `INVALID_INPUT` | 400 | Input validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `UNAUTHORIZED` | 401 | Not authorized |
| `CONFLICT` | 409 | Resource already exists |
| `INTERNAL_ERROR` | 500 | Server error |
| `DUPLICATE_PAYMENT` | 409 | Participant already marked as paid |

---

## Bill Endpoints

### Create Bill

**Endpoint:** `POST /bills`

**Request:**
```json
{
  "organizerId": "org123",
  "title": "Team Lunch",
  "description": "Team lunch at The Pavilion",
  "totalAmount": 500,
  "currency": "MYR",
  "dueDate": "2026-06-01T23:59:59Z",
  "participants": [
    {
      "name": "John Doe",
      "email": "john@example.com",
      "amount": 100
    },
    {
      "name": "Jane Smith",
      "email": "jane@example.com",
      "amount": 100
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "bill_abc123xyz",
    "organizerId": "org123",
    "title": "Team Lunch",
    "description": "Team lunch at The Pavilion",
    "totalAmount": 500,
    "currency": "MYR",
    "dueDate": "2026-06-01T23:59:59Z",
    "status": "active",
    "shareLink": "gocheck.com/bill/xyz123abc",
    "participants": [
      {
        "id": "part_001",
        "name": "John Doe",
        "email": "john@example.com",
        "amount": 100,
        "isPaid": false,
        "paidAt": null
      },
      {
        "id": "part_002",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "amount": 100,
        "isPaid": false,
        "paidAt": null
      }
    ],
    "createdAt": "2026-05-22T16:20:00Z",
    "updatedAt": "2026-05-22T16:20:00Z"
  },
  "message": "Bill created successfully"
}
```

**Validation:**
- Title: required, min 3 chars, max 100 chars
- Amount: required, must be > 0
- Due date: must be in future
- Participants: min 2, all amounts must sum to total
- Currency: valid ISO 4217 code

---

### Get Bill (Organizer)

**Endpoint:** `GET /bills/:billId`

**Query Parameters:**
- `organizerId` (required) - organizer ID to verify ownership

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "bill_abc123xyz",
    "organizerId": "org123",
    "title": "Team Lunch",
    "totalAmount": 500,
    "currency": "MYR",
    "dueDate": "2026-06-01T23:59:59Z",
    "status": "active",
    "shareLink": "gocheck.com/bill/xyz123abc",
    "participants": [...],
    "createdAt": "2026-05-22T16:20:00Z",
    "updatedAt": "2026-05-22T16:20:00Z"
  }
}
```

**Error:** 404 if bill not found, 401 if not bill owner

---

### Get Bill (Public)

**Endpoint:** `GET /bills/share/:shareLink`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "bill_abc123xyz",
    "title": "Team Lunch",
    "totalAmount": 500,
    "currency": "MYR",
    "dueDate": "2026-06-01T23:59:59Z",
    "description": "Team lunch at The Pavilion",
    "status": "active",
    "participants": [
      {
        "id": "part_001",
        "name": "John Doe",
        "amount": 100,
        "isPaid": true,
        "paidAt": "2026-05-22T17:00:00Z"
      },
      {
        "id": "part_002",
        "name": "Jane Smith",
        "amount": 100,
        "isPaid": false,
        "paidAt": null
      }
    ],
    "summary": {
      "totalAmount": 500,
      "amountCollected": 100,
      "remainingAmount": 400,
      "percentagePaid": 20,
      "participantsPaid": 1,
      "participantsTotal": 2
    }
  }
}
```

**Note:** Public response excludes organizer ID, doesn't include edit permissions

---

### Update Bill

**Endpoint:** `PUT /bills/:billId`

**Request:**
```json
{
  "organizerId": "org123",
  "title": "Team Lunch - Updated",
  "description": "Updated location",
  "dueDate": "2026-06-02T23:59:59Z"
}
```

**Response (200):** Updated bill object

**Constraints:**
- Only organizer can update
- Cannot update amount or participants after creation
- Can only update title, description, dueDate

---

### Delete Bill

**Endpoint:** `DELETE /bills/:billId`

**Request:**
```json
{
  "organizerId": "org123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Bill deleted successfully"
}
```

**Error:** 404 if not found, 401 if not owner

---

### List Bills (Organizer)

**Endpoint:** `GET /organizer/:organizerId/bills`

**Query Parameters:**
- `status` (optional) - 'active', 'complete', or 'all' (default: 'all')
- `page` (optional) - page number (default: 1)
- `limit` (optional) - items per page (default: 10, max: 50)
- `sortBy` (optional) - 'recent', 'dueDate', 'amountDesc', 'amountAsc'

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "bill_abc123xyz",
      "title": "Team Lunch",
      "totalAmount": 500,
      "currency": "MYR",
      "dueDate": "2026-06-01T23:59:59Z",
      "status": "active",
      "summary": {
        "amountCollected": 100,
        "remainingAmount": 400,
        "percentagePaid": 20,
        "participantsPaid": 1,
        "participantsTotal": 2
      },
      "createdAt": "2026-05-22T16:20:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "pages": 1
  }
}
```

---

## Payment Endpoints

### Mark as Paid

**Endpoint:** `POST /payments/confirm`

**Request:**
```json
{
  "billId": "bill_abc123xyz",
  "participantId": "part_001",
  "shareLink": "xyz123abc"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "payment_def456",
    "billId": "bill_abc123xyz",
    "participantId": "part_001",
    "amount": 100,
    "status": "confirmed",
    "confirmedAt": "2026-05-22T17:00:00Z",
    "participant": {
      "id": "part_001",
      "name": "John Doe",
      "isPaid": true
    }
  },
  "message": "Payment confirmed successfully"
}
```

**Errors:**
- `NOT_FOUND` (404) - Bill or participant not found
- `DUPLICATE_PAYMENT` (409) - Already marked as paid
- `INVALID_LINK` (401) - Share link invalid or expired

**Business Logic:**
- Idempotent: Calling twice with same data returns success both times
- Updates participant `isPaid = true` and `paidAt = now`
- Updates bill status if all paid

---

### Get Payment Status

**Endpoint:** `GET /payments/:billId/status`

**Query Parameters:**
- `shareLink` (required) - for public access

**Response (200):**
```json
{
  "success": true,
  "data": {
    "billId": "bill_abc123xyz",
    "summary": {
      "totalAmount": 500,
      "amountCollected": 250,
      "remainingAmount": 250,
      "percentagePaid": 50,
      "participantsPaid": 2,
      "participantsTotal": 4,
      "daysUntilDue": 10,
      "isOverdue": false
    },
    "participants": [
      {
        "id": "part_001",
        "name": "John Doe",
        "amount": 100,
        "isPaid": true,
        "paidAt": "2026-05-22T17:00:00Z"
      },
      {
        "id": "part_002",
        "name": "Jane Smith",
        "amount": 100,
        "isPaid": true,
        "paidAt": "2026-05-22T17:15:00Z"
      },
      {
        "id": "part_003",
        "name": "Bob Wilson",
        "amount": 100,
        "isPaid": false,
        "paidAt": null
      },
      {
        "id": "part_004",
        "name": "Alice Lee",
        "amount": 200,
        "isPaid": false,
        "paidAt": null
      }
    ]
  }
}
```

---

## Link Endpoints

### Generate Share Link

**Endpoint:** `POST /links/generate`

**Request:**
```json
{
  "billId": "bill_abc123xyz",
  "organizerId": "org123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "billId": "bill_abc123xyz",
    "shareLink": "gocheck.com/bill/xyz123abc",
    "shortCode": "xyz123abc",
    "expiresAt": null
  },
  "message": "Share link generated"
}
```

**Note:** Links don't expire in MVP (future: add expiration)

---

### Get Link Info

**Endpoint:** `GET /links/:shareLink`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "shareLink": "xyz123abc",
    "billId": "bill_abc123xyz",
    "isValid": true,
    "createdAt": "2026-05-22T16:20:00Z",
    "expiresAt": null
  }
}
```

---

## Rate Limiting

### Limits (per IP, per hour)

| Endpoint | Limit | Notes |
|----------|-------|-------|
| POST /bills | 100 | Create bill |
| GET /bills/share/* | 1000 | Public access |
| POST /payments/confirm | 500 | Payment confirmation |
| Others | 500 | General endpoints |

**Response (429 - Too Many Requests):**
```json
{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please try again later.",
  "retryAfter": 3600
}
```

---

## CORS Headers

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

---

## Pagination

For list endpoints, pagination is included:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "pages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Query Parameters:**
- `page` - page number (default: 1)
- `limit` - items per page (default: 10, max: 100)

---

## Timestamps

All timestamps are in ISO 8601 format with UTC timezone:
- `2026-05-22T16:20:00Z`

---

## API Version

**Current:** v1  
**Header:** `X-API-Version: 1`

---

## Webhook Events (Future)

Planned for Phase 2:
- `bill.created` - New bill created
- `payment.confirmed` - Payment marked
- `bill.completed` - All payments received
- `bill.overdue` - Due date passed without full payment

---

## Code Examples

### JavaScript/TypeScript

```typescript
const createBill = async (billData) => {
  const response = await fetch('/api/bills', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(billData)
  });
  return response.json();
};

const confirmPayment = async (billId, participantId, shareLink) => {
  const response = await fetch('/api/payments/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ billId, participantId, shareLink })
  });
  return response.json();
};
```

### cURL

```bash
# Create bill
curl -X POST http://localhost:5000/api/bills \
  -H "Content-Type: application/json" \
  -d '{
    "organizerId": "org123",
    "title": "Team Lunch",
    "totalAmount": 500,
    "currency": "MYR",
    "dueDate": "2026-06-01T23:59:59Z",
    "participants": [{"name": "John", "amount": 250}, {"name": "Jane", "amount": 250}]
  }'

# Get bill (public)
curl http://localhost:5000/api/bills/share/xyz123abc

# Confirm payment
curl -X POST http://localhost:5000/api/payments/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "billId": "bill_abc123xyz",
    "participantId": "part_001",
    "shareLink": "xyz123abc"
  }'
```

---

## Future Enhancements

- [ ] JWT authentication
- [ ] Webhook events
- [ ] Batch payment operations
- [ ] Custom split amounts
- [ ] Payment history/audit trail
- [ ] Recurring bills
- [ ] Multi-currency exchange rates
- [ ] API keys for third-party integrations
