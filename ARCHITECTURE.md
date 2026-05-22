# GoCheck Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐   │
│  │ Bill Creation    │  │ Bill Detail      │  │   Dashboard  │   │
│  │    Page          │  │   (Shared Link)  │  │  (Organizer) │   │
│  └──────────────────┘  └──────────────────┘  └──────────────┘   │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  REST API       │
                    │  (Express)      │
                    └────────┬────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                    Backend (Node.js)                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐   │
│  │ Bill Routes      │  │ Payment Routes   │  │ Link Routes  │   │
│  └──────────────────┘  └──────────────────┘  └──────────────┘   │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ Bill Controller  │  │ Payment          │                     │
│  │                  │  │ Controller       │                     │
│  └──────────────────┘  └──────────────────┘                     │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Database       │
                    │  (MongoDB/PG)   │
                    └────────────────┘
```

## Data Models

### Bill
```typescript
interface Bill {
  id: string;                    // Unique ID
  organizerId: string;           // User who created
  title: string;                 // Bill name
  description?: string;          // Optional details
  totalAmount: number;           // Total amount to split
  currency: string;              // Currency (e.g., MYR)
  dueDate: Date;                 // Payment deadline
  participants: Participant[];   // List of people paying
  createdAt: Date;               // Creation timestamp
  updatedAt: Date;               // Last update
  status: 'active' | 'complete'; // Bill status
  shareLink: string;             // Unique shareable URL
}
```

### Participant
```typescript
interface Participant {
  id: string;
  billId: string;
  name: string;                  // Participant name
  email?: string;                // Optional email
  amount: number;                // Amount they owe
  isPaid: boolean;               // Payment status
  paidAt?: Date;                 // When they paid
}
```

### Payment
```typescript
interface Payment {
  id: string;
  participantId: string;
  billId: string;
  amount: number;
  status: 'pending' | 'confirmed'; // Simulated payment status
  confirmedAt?: Date;
  timestamp: Date;
}
```

## API Endpoints

### Bill Endpoints

#### Create Bill
```
POST /api/bills
Body: {
  organizerId: string,
  title: string,
  description?: string,
  totalAmount: number,
  currency: string,
  dueDate: Date,
  participants: Array<{name, email?, amount}>
}
Response: {
  id, title, totalAmount, shareLink, ...
}
```

#### Get Bill (for organizer)
```
GET /api/bills/:billId
Query: { organizerId }
Response: Full bill with all participants and payments
```

#### Get Bill (public via share link)
```
GET /api/bills/share/:shareLink
Response: Bill with payment status summary (no sensitive data)
```

#### Update Bill
```
PUT /api/bills/:billId
Body: { title?, description?, dueDate?, participants? }
Response: Updated bill
```

#### Delete Bill
```
DELETE /api/bills/:billId
Response: { success: true }
```

#### List Bills (for organizer)
```
GET /api/organizer/:organizerId/bills
Response: Array of bills (summary)
```

### Payment Endpoints

#### Mark as Paid
```
POST /api/payments/confirm
Body: {
  billId: string,
  participantId: string,
  shareLink: string
}
Response: { success: true, participant, bill }
```

#### Get Payment Status
```
GET /api/payments/:billId/status
Response: {
  totalAmount,
  amountCollected,
  remainingAmount,
  totalParticipants,
  paidCount,
  participants: [{name, isPaid, paidAt}]
}
```

### Link Endpoints

#### Generate Share Link
```
POST /api/links/generate
Body: { billId }
Response: { shareLink, shortCode }
```

## Frontend Flow

### Bill Creation Flow
```
1. User clicks "Create Bill"
2. Form appears with fields:
   - Title, Amount, Due Date, Description
   - Add participants (name, email, amount)
3. User submits
4. POST /api/bills
5. Backend returns bill with shareLink
6. Show "Bill Created!" with copy link button
7. Redirect to dashboard
```

### Member Payment Flow
```
1. User receives link (via WhatsApp, email)
2. Opens /bill/:shareLink
3. GET /api/bills/share/:shareLink
4. Display bill details and payment status
5. User clicks "I've Paid"
6. POST /api/payments/confirm
7. Show confirmation
8. Update participant status to paid
```

### Organizer Dashboard Flow
```
1. User logs in / accesses dashboard
2. GET /api/organizer/:organizerId/bills
3. Display list of all bills
4. For each bill, show:
   - Title, amount, due date
   - Payment progress bar
   - Quick copy link button
5. Click bill to view details
6. See all participants and payment status
7. Manual mark/unmark payment option
```

## Database Schema

### MongoDB Collections

```javascript
// bills collection
db.bills.createIndex({ organizerId: 1 })
db.bills.createIndex({ shareLink: 1 }, { unique: true })

// participants collection
db.participants.createIndex({ billId: 1 })

// payments collection
db.payments.createIndex({ billId: 1 })
db.payments.createIndex({ participantId: 1 })
```

### PostgreSQL Schema

```sql
CREATE TABLE bills (
  id UUID PRIMARY KEY,
  organizer_id VARCHAR NOT NULL,
  title VARCHAR NOT NULL,
  description TEXT,
  total_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'MYR',
  due_date TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active',
  share_link VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE participants (
  id UUID PRIMARY KEY,
  bill_id UUID REFERENCES bills(id),
  name VARCHAR NOT NULL,
  email VARCHAR,
  amount DECIMAL(10,2) NOT NULL,
  is_paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY,
  participant_id UUID REFERENCES participants(id),
  bill_id UUID REFERENCES bills(id),
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  confirmed_at TIMESTAMP,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

## Security Considerations

1. **Share Link Security:**
   - Use random, unguessable strings
   - 12-16 character alphanumeric codes
   - No sequential IDs

2. **Organizer Access:**
   - Session-based simple auth (no passwords initially)
   - Organizer ID required for protected endpoints
   - Validate organizerId on bill operations

3. **Data Validation:**
   - Validate all inputs on backend
   - Sanitize strings to prevent XSS
   - Rate limiting on public endpoints

4. **Payment Confirmation:**
   - One-time confirmation (prevent duplicate claims)
   - Idempotent endpoints
   - Audit trail of all payment marks

## Deployment Architecture

```
┌─────────────────────────────────┐
│   Vercel / Netlify              │
│   (Frontend - React)            │
│   URL: app.gocheck.com          │
└──────────────┬──────────────────┘
               │
               │ HTTPS API calls
               │
┌──────────────▼──────────────────┐
│   Railway / Heroku              │
│   (Backend - Node.js)           │
│   URL: api.gocheck.com          │
└──────────────┬──────────────────┘
               │
               │ Connection pool
               │
┌──────────────▼──────────────────┐
│   MongoDB Atlas / PostgreSQL    │
│   (Database)                    │
└─────────────────────────────────┘
```

## Performance Optimization

1. **Frontend:**
   - Code splitting for lazy loading
   - Image optimization
   - CSS minification
   - Bundle size tracking

2. **Backend:**
   - Database query optimization
   - Caching layer (Redis) for frequently accessed data
   - Pagination for large lists
   - Connection pooling

3. **API:**
   - Response compression
   - API rate limiting
   - Efficient query design

## Monitoring & Logging

- Error tracking (Sentry)
- Analytics (Google Analytics or Mixpanel)
- Server monitoring (Uptime Robot)
- Database monitoring (native tools)
