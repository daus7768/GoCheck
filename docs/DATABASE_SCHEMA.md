# GoCheck Database Schema

## Overview

GoCheck supports both **MongoDB** and **PostgreSQL**. This document covers both implementations.

---

## MongoDB Schema

### Collections

#### Bills Collection

```javascript
db.bills.createIndex({ organizerId: 1 });
db.bills.createIndex({ shareLink: 1 }, { unique: true });
db.bills.createIndex({ createdAt: -1 });
db.bills.createIndex({ dueDate: 1 });
db.bills.createIndex({ status: 1 });

// Sample Document
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  organizerId: "org_user_123",
  title: "Team Lunch at The Pavilion",
  description: "Team gathering for lunch",
  totalAmount: 500,
  currency: "MYR",
  dueDate: ISODate("2026-06-01T23:59:59Z"),
  status: "active", // 'active' | 'complete' | 'cancelled'
  shareLink: "xyz123abc", // Unique share link code
  participantIds: [
    ObjectId("507f1f77bcf86cd799439012"),
    ObjectId("507f1f77bcf86cd799439013")
  ],
  createdAt: ISODate("2026-05-22T16:20:00Z"),
  updatedAt: ISODate("2026-05-22T16:20:00Z")
}
```

---

#### Participants Collection

```javascript
db.participants.createIndex({ billId: 1 });
db.participants.createIndex({ email: 1 });
db.participants.createIndex({ billId: 1, isPaid: 1 });

// Sample Document
{
  _id: ObjectId("507f1f77bcf86cd799439012"),
  billId: ObjectId("507f1f77bcf86cd799439011"),
  name: "John Doe",
  email: "john@example.com",
  amount: 100,
  isPaid: false,
  paidAt: null,
  createdAt: ISODate("2026-05-22T16:20:00Z"),
  updatedAt: ISODate("2026-05-22T16:20:00Z")
}
```

---

#### Payments Collection

```javascript
db.payments.createIndex({ billId: 1 });
db.payments.createIndex({ participantId: 1 });
db.payments.createIndex({ status: 1 });
db.payments.createIndex({ timestamp: -1 });

// Sample Document
{
  _id: ObjectId("507f1f77bcf86cd799439020"),
  billId: ObjectId("507f1f77bcf86cd799439011"),
  participantId: ObjectId("507f1f77bcf86cd799439012"),
  amount: 100,
  status: "confirmed", // 'pending' | 'confirmed' | 'failed'
  confirmedAt: ISODate("2026-05-22T17:00:00Z"),
  timestamp: ISODate("2026-05-22T17:00:00Z"),
  metadata: {
    ipAddress: "192.168.1.1",
    userAgent: "Mozilla/5.0...",
    method: "web" // 'web', 'mobile', 'api'
  }
}
```

---

#### Share Links Collection

```javascript
db.shareLinks.createIndex({ code: 1 }, { unique: true });
db.shareLinks.createIndex({ billId: 1 });
db.shareLinks.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Sample Document
{
  _id: ObjectId("507f1f77bcf86cd799439030"),
  code: "xyz123abc",
  billId: ObjectId("507f1f77bcf86cd799439011"),
  isActive: true,
  createdAt: ISODate("2026-05-22T16:20:00Z"),
  expiresAt: null, // null = no expiration
  accessCount: 45,
  lastAccessedAt: ISODate("2026-05-22T17:30:00Z")
}
```

---

#### Organizers Collection (Optional)

```javascript
db.organizers.createIndex({ userId: 1 }, { unique: true });
db.organizers.createIndex({ email: 1 }, { unique: true });

// Sample Document
{
  _id: ObjectId("507f1f77bcf86cd799439040"),
  userId: "org_user_123",
  email: "organizer@example.com",
  name: "Organizer Name",
  phoneNumber: "+60123456789",
  billsCreated: 12,
  totalCollected: 5500,
  createdAt: ISODate("2026-05-01T10:00:00Z"),
  updatedAt: ISODate("2026-05-22T16:20:00Z"),
  settings: {
    notificationsEnabled: true,
    darkMode: true,
    currency: "MYR"
  }
}
```

---

## PostgreSQL Schema

### Tables

#### bills table

```sql
CREATE TABLE bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'MYR',
  due_date TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'complete', 'cancelled')),
  share_link VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bills_organizer_id ON bills(organizer_id);
CREATE INDEX idx_bills_share_link ON bills(share_link);
CREATE INDEX idx_bills_created_at ON bills(created_at DESC);
CREATE INDEX idx_bills_due_date ON bills(due_date);
CREATE INDEX idx_bills_status ON bills(status);
```

---

#### participants table

```sql
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_participants_bill_id ON participants(bill_id);
CREATE INDEX idx_participants_email ON participants(email);
CREATE INDEX idx_participants_bill_paid ON participants(bill_id, is_paid);
```

---

#### payments table

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  confirmed_at TIMESTAMP,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(45),
  user_agent TEXT
);

CREATE INDEX idx_payments_bill_id ON payments(bill_id);
CREATE INDEX idx_payments_participant_id ON payments(participant_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_timestamp ON payments(timestamp DESC);
```

---

#### share_links table

```sql
CREATE TABLE share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP,
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMP
);

CREATE INDEX idx_share_links_code ON share_links(code);
CREATE INDEX idx_share_links_bill_id ON share_links(bill_id);
```

---

#### organizers table (Optional)

```sql
CREATE TABLE organizers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  phone_number VARCHAR(20),
  bills_created INTEGER NOT NULL DEFAULT 0,
  total_collected DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Settings (store as JSONB for flexibility)
  settings JSONB DEFAULT '{}'
);

CREATE INDEX idx_organizers_user_id ON organizers(user_id);
CREATE INDEX idx_organizers_email ON organizers(email);
```

---

## Relationships

### Entity-Relationship Diagram

```
┌─────────────────┐
│   Organizers    │
│   (Optional)    │
└────────┬────────┘
         │
         │ creates
         │
         ▼
┌─────────────────────────┐         ┌──────────────────────┐
│        Bills            │────────▶│    Share Links       │
│  - organizerId (FK)     │ has     │  - billId (FK)       │
│  - title                │         │  - code (unique)     │
│  - totalAmount          │         │  - isActive          │
│  - dueDate              │         └──────────────────────┘
│  - status               │
│  - shareLink            │
└────────┬────────────────┘
         │
         │ contains
         │
         ▼
┌─────────────────────────┐         ┌──────────────────────┐
│     Participants        │◀────────│      Payments        │
│  - billId (FK)          │ tracked │  - billId (FK)       │
│  - name                 │ by      │  - participantId (FK)│
│  - email                │         │  - status            │
│  - amount               │         │  - confirmedAt       │
│  - isPaid               │         └──────────────────────┘
│  - paidAt               │
└─────────────────────────┘
```

---

## Data Flow

### Create Bill Flow

```
1. Organizer creates bill
   ↓
2. INSERT into bills table
   ↓
3. Generate shareLink code
   ↓
4. INSERT into share_links table
   ↓
5. For each participant:
   - INSERT into participants table
   ↓
6. Return bill with shareLink
```

### Payment Confirmation Flow

```
1. Member clicks "I've Paid" button
   ↓
2. Verify shareLink validity
   ↓
3. Check if participant already paid
   ↓
4. UPDATE participants.isPaid = true
   ↓
5. UPDATE participants.paidAt = NOW()
   ↓
6. INSERT into payments table (audit trail)
   ↓
7. Return confirmation
   ↓
8. Check if all participants paid → UPDATE bill.status = 'complete'
```

---

## Queries

### MongoDB Queries

#### Get bill with participants
```javascript
db.bills.aggregate([
  { $match: { _id: ObjectId("...") } },
  {
    $lookup: {
      from: "participants",
      localField: "_id",
      foreignField: "billId",
      as: "participants"
    }
  },
  {
    $project: {
      _id: 1,
      title: 1,
      totalAmount: 1,
      participants: 1,
      participantsPaid: {
        $size: {
          $filter: {
            input: "$participants",
            as: "p",
            cond: { $eq: ["$$p.isPaid", true] }
          }
        }
      },
      totalParticipants: { $size: "$participants" },
      amountCollected: {
        $sum: {
          $map: {
            input: "$participants",
            as: "p",
            in: { $cond: ["$$p.isPaid", "$$p.amount", 0] }
          }
        }
      }
    }
  }
]);
```

#### Get organizer bills with summaries
```javascript
db.bills.aggregate([
  { $match: { organizerId: "org_123" } },
  {
    $lookup: {
      from: "participants",
      localField: "_id",
      foreignField: "billId",
      as: "participants"
    }
  },
  {
    $addFields: {
      paidCount: {
        $size: {
          $filter: {
            input: "$participants",
            as: "p",
            cond: { $eq: ["$$p.isPaid", true] }
          }
        }
      },
      amountCollected: {
        $sum: {
          $map: {
            input: "$participants",
            as: "p",
            in: { $cond: ["$$p.isPaid", "$$p.amount", 0] }
          }
        }
      }
    }
  },
  { $sort: { createdAt: -1 } },
  { $limit: 10 }
]);
```

### PostgreSQL Queries

#### Get bill with participants and payment status
```sql
SELECT
  b.id,
  b.title,
  b.total_amount,
  b.currency,
  b.due_date,
  b.status,
  COUNT(p.id) as total_participants,
  SUM(CASE WHEN p.is_paid THEN 1 ELSE 0 END) as paid_count,
  SUM(CASE WHEN p.is_paid THEN p.amount ELSE 0 END) as amount_collected,
  SUM(CASE WHEN NOT p.is_paid THEN p.amount ELSE 0 END) as amount_remaining
FROM bills b
LEFT JOIN participants p ON b.id = p.bill_id
WHERE b.id = $1
GROUP BY b.id;
```

#### Get all participants for a bill
```sql
SELECT
  id,
  name,
  email,
  amount,
  is_paid,
  paid_at
FROM participants
WHERE bill_id = $1
ORDER BY name ASC;
```

#### Get payment history
```sql
SELECT
  pa.id,
  pa.amount,
  pa.status,
  pa.confirmed_at,
  pr.name as participant_name,
  b.title as bill_title
FROM payments pa
JOIN participants pr ON pa.participant_id = pr.id
JOIN bills b ON pa.bill_id = b.id
WHERE pa.bill_id = $1
ORDER BY pa.timestamp DESC;
```

---

## Performance Considerations

### MongoDB
- Index on `organizerId` for dashboard queries
- Index on `shareLink` for public access
- Use aggregation pipeline for complex queries
- Consider denormalizing payment counts to bills

### PostgreSQL
- Use EXPLAIN ANALYZE to optimize queries
- Add composite indexes for common filter combinations
- Consider materialized views for dashboards
- Archive old completed bills separately

---

## Backup Strategy

### MongoDB
```bash
# Backup
mongodump --uri "mongodb+srv://user:pass@cluster.mongodb.net/gocheck"

# Restore
mongorestore --uri "mongodb+srv://user:pass@cluster.mongodb.net/gocheck" dump/
```

### PostgreSQL
```bash
# Backup
pg_dump -h localhost -U user -d gocheck > backup.sql

# Restore
psql -h localhost -U user -d gocheck < backup.sql
```

---

## Data Retention

- **Active bills:** Keep indefinitely
- **Completed bills:** Soft delete (mark as 'complete'), keep for 2 years
- **Payment records:** Keep for 7 years (audit/legal compliance)
- **Logs:** Keep for 30 days
