# GoCheck Testing Guide

## Testing Strategy

### Test Levels

1. **Unit Tests** - Test individual components/functions
2. **Integration Tests** - Test multiple components together
3. **E2E Tests** - Test complete user flows
4. **Manual Tests** - Test on actual devices (especially mobile)

### Coverage Goals

- **Backend:** 80%+ code coverage
- **Frontend:** 70%+ code coverage
- **Critical paths:** 100% coverage

---

## Backend Testing

### Setup

```bash
cd backend
npm install --save-dev jest supertest ts-jest
```

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    }
  }
};
```

### Unit Test Examples

#### Test: Bill Creation Validation

```typescript
// src/__tests__/controllers/billController.test.ts
import { createBill } from '../../controllers/billController';
import { Bill } from '../../models/Bill';

jest.mock('../../models/Bill');

describe('Bill Controller', () => {
  describe('createBill', () => {
    it('should create a bill with valid data', async () => {
      const mockBill = {
        id: 'bill_123',
        title: 'Test Bill',
        totalAmount: 500,
        organizerId: 'org_123'
      };

      (Bill.create as jest.Mock).mockResolvedValue(mockBill);

      const result = await createBill(mockBill);

      expect(result).toEqual(mockBill);
      expect(Bill.create).toHaveBeenCalledWith(mockBill);
    });

    it('should throw error for invalid amount', async () => {
      const invalidBill = {
        title: 'Test Bill',
        totalAmount: -100,
        organizerId: 'org_123'
      };

      await expect(createBill(invalidBill)).rejects.toThrow(
        'Amount must be greater than 0'
      );
    });

    it('should throw error for missing title', async () => {
      const invalidBill = {
        totalAmount: 500,
        organizerId: 'org_123'
      };

      await expect(createBill(invalidBill)).rejects.toThrow(
        'Title is required'
      );
    });
  });
});
```

#### Test: Payment Confirmation

```typescript
// src/__tests__/controllers/paymentController.test.ts
import { confirmPayment } from '../../controllers/paymentController';
import { Participant } from '../../models/Participant';

describe('Payment Controller', () => {
  describe('confirmPayment', () => {
    it('should mark participant as paid', async () => {
      const mockParticipant = {
        id: 'part_001',
        billId: 'bill_123',
        name: 'John Doe',
        isPaid: true,
        paidAt: new Date()
      };

      (Participant.update as jest.Mock).mockResolvedValue(mockParticipant);

      const result = await confirmPayment('bill_123', 'part_001', 'xyz123');

      expect(result.isPaid).toBe(true);
      expect(Participant.update).toHaveBeenCalled();
    });

    it('should prevent duplicate payment confirmation', async () => {
      (Participant.findById as jest.Mock).mockResolvedValue({
        id: 'part_001',
        isPaid: true
      });

      await expect(
        confirmPayment('bill_123', 'part_001', 'xyz123')
      ).rejects.toThrow('Already marked as paid');
    });
  });
});
```

### Integration Test Examples

#### Test: Complete Bill Creation Flow

```typescript
// src/__tests__/integration/billFlow.test.ts
import request from 'supertest';
import app from '../../server';
import { Bill } from '../../models/Bill';

describe('Bill Creation Flow', () => {
  it('should create bill and generate share link', async () => {
    const billData = {
      organizerId: 'org_123',
      title: 'Team Lunch',
      totalAmount: 500,
      currency: 'MYR',
      dueDate: new Date(Date.now() + 86400000),
      participants: [
        { name: 'John', amount: 250 },
        { name: 'Jane', amount: 250 }
      ]
    };

    const response = await request(app)
      .post('/api/bills')
      .send(billData);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.shareLink).toBeDefined();
    expect(response.body.data.participants).toHaveLength(2);
  });

    it('should retrieve bill via share link', async () => {
    // First create a bill
    const billResponse = await request(app)
      .post('/api/bills')
      .send(billData);

    const shareLink = billResponse.body.data.shareLink;

    // Then retrieve it
    const getResponse = await request(app)
      .get(`/api/bills/share/${shareLink}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.data.title).toBe('Team Lunch');
  });
});
```

#### Test: Payment Flow

```typescript
// src/__tests__/integration/paymentFlow.test.ts
it('should complete full payment flow', async () => {
  // 1. Create bill
  const billResponse = await request(app).post('/api/bills').send(billData);
  const billId = billResponse.body.data.id;
  const shareLink = billResponse.body.data.shareLink;
  const participantId = billResponse.body.data.participants[0].id;

  // 2. Confirm payment
  const paymentResponse = await request(app)
    .post('/api/payments/confirm')
    .send({
      billId,
      participantId,
      shareLink
    });

  expect(paymentResponse.status).toBe(200);
  expect(paymentResponse.body.data.status).toBe('confirmed');

  // 3. Check status
  const statusResponse = await request(app)
    .get(`/api/payments/${billId}/status`)
    .query({ shareLink });

  expect(statusResponse.body.data.summary.participantsPaid).toBe(1);
});
```

### Running Tests

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test -- billController.test.ts

# Run in watch mode
npm run test:watch
```

---

## Frontend Testing

### Setup

```bash
cd frontend
npm install --save-dev @testing-library/react @testing-library/jest-dom vitest
```

### Component Test Examples

#### Test: Bill Card Component

```typescript
// src/__tests__/components/BillCard.test.tsx
import { render, screen } from '@testing-library/react';
import { BillCard } from '../../components/Bill/BillCard';

describe('BillCard Component', () => {
  const mockBill = {
    id: 'bill_123',
    title: 'Team Lunch',
    totalAmount: 500,
    currency: 'MYR',
    dueDate: new Date(Date.now() + 86400000),
    summary: {
      amountCollected: 250,
      remainingAmount: 250,
      percentagePaid: 50,
      participantsPaid: 1,
      participantsTotal: 2
    }
  };

  it('should render bill details', () => {
    render(<BillCard bill={mockBill} />);

    expect(screen.getByText('Team Lunch')).toBeInTheDocument();
    expect(screen.getByText(/MYR 500/)).toBeInTheDocument();
    expect(screen.getByText(/1\s*\/\s*2/)).toBeInTheDocument();
  });

  it('should display progress bar', () => {
    render(<BillCard bill={mockBill} />);

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '50');
  });

  it('should show copy link button', () => {
    render(<BillCard bill={mockBill} />);

    expect(screen.getByText(/Copy Link/i)).toBeInTheDocument();
  });
});
```

#### Test: Progress Bar Component

```typescript
// src/__tests__/components/ProgressBar.test.tsx
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../../components/Bill/ProgressBar';

describe('ProgressBar Component', () => {
  it('should render with correct percentage', () => {
    render(<ProgressBar percentage={75} />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '75');
  });

  it('should show percentage text', () => {
    render(<ProgressBar percentage={75} showLabel />);

    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('should apply success state at 100%', () => {
    const { container } = render(<ProgressBar percentage={100} />);

    const bar = container.querySelector('.progress-bar');
    expect(bar).toHaveClass('success');
  });
});
```

#### Test: Bill Creation Form

```typescript
// src/__tests__/pages/CreateBill.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateBill } from '../../pages/CreateBill';

const mockCreateBill = jest.fn();
jest.mock('../../services/billService', () => ({
  billService: {
    create: mockCreateBill
  }
}));

describe('CreateBill Page', () => {
  it('should submit form with valid data', async () => {
    const user = userEvent.setup();
    render(<CreateBill />);

    // Fill form
    await user.type(screen.getByLabelText(/Bill Title/i), 'Team Lunch');
    await user.type(screen.getByLabelText(/Total Amount/i), '500');
    await user.type(screen.getByLabelText(/Description/i), 'Lunch gathering');

    // Submit
    await user.click(screen.getByText(/Create Bill/i));

    // Verify API call
    await waitFor(() => {
      expect(mockCreateBill).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Team Lunch',
          totalAmount: 500
        })
      );
    });
  });

  it('should show validation errors', async () => {
    const user = userEvent.setup();
    render(<CreateBill />);

    // Try to submit empty form
    await user.click(screen.getByText(/Create Bill/i));

    await waitFor(() => {
      expect(screen.getByText(/Title is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Amount is required/i)).toBeInTheDocument();
    });
  });
});
```

### Running Frontend Tests

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run specific test
npm run test BillCard.test.tsx

# Run in watch mode
npm run test:watch
```

---

## E2E Testing (Playwright)

### Setup

```bash
npm install --save-dev @playwright/test
npx playwright install
```

### E2E Test Examples

#### Test: Complete User Journey

```typescript
// e2e/billFlow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Complete Bill Flow', () => {
  test('organizer creates bill and member confirms payment', async ({ browser }) => {
    const context = await browser.newContext();
    const organizerPage = await context.newPage();
    const memberPage = await context.newPage();

    // 1. Organizer creates bill
    await organizerPage.goto('http://localhost:5173');
    await organizerPage.click('button:has-text("Create Bill")');

    await organizerPage.fill('input[name="title"]', 'Team Lunch');
    await organizerPage.fill('input[name="totalAmount"]', '500');

    // Add participants
    await organizerPage.click('button:has-text("Add Participant")');
    await organizerPage.fill('input[placeholder="Participant Name"]', 'John Doe');
    await organizerPage.fill('input[placeholder="Amount"]', '250');

    await organizerPage.click('button:has-text("Add Participant")');
    const nameInputs = await organizerPage.$$('input[placeholder="Participant Name"]');
    await nameInputs[1].fill('Jane Smith');
    const amountInputs = await organizerPage.$$('input[placeholder="Amount"]');
    await amountInputs[1].fill('250');

    // Submit
    await organizerPage.click('button:has-text("Create Bill")');
    await organizerPage.waitForNavigation();

    // Get share link
    const shareLink = await organizerPage.textContent('.share-link');
    const url = shareLink?.match(/http[^\s]+/)![0];

    // 2. Member opens shared bill
    await memberPage.goto(url!);

    // 3. Verify bill details
    expect(await memberPage.textContent('h1')).toContain('Team Lunch');
    expect(await memberPage.textContent('.total-amount')).toContain('MYR 500');

    // 4. Member marks as paid
    await memberPage.click('button:has-text("I\'ve Paid")');
    await memberPage.waitForTimeout(500);

    // 5. Verify confirmation
    expect(await memberPage.textContent('.confirmation')).toContain('Payment confirmed');

    // 6. Organizer sees update
    await organizerPage.reload();
    expect(await organizerPage.textContent('.progress-text')).toContain('1 / 2');
  });
});
```

### Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e -- --ui

# Debug mode
npm run test:e2e -- --debug
```

---

## Manual Testing Checklist

### Desktop Testing

- [ ] Create bill with all fields
- [ ] Edit bill title/description
- [ ] Delete bill
- [ ] Copy share link
- [ ] View dashboard
- [ ] Sort/filter bills
- [ ] Dark mode toggle
- [ ] Long bill titles wrap correctly
- [ ] Large amounts display correctly

### Mobile Testing

- [ ] Responsive layout (375px, 768px)
- [ ] Touch-friendly buttons (min 44px)
- [ ] Share link opens correctly
- [ ] Payment confirmation button accessible
- [ ] Forms are usable on small screens
- [ ] No horizontal scroll
- [ ] Keyboard accessible
- [ ] Works on iOS Safari
- [ ] Works on Chrome Mobile

### Browser Testing

- [ ] Chrome latest
- [ ] Firefox latest
- [ ] Safari latest
- [ ] Edge latest

### Payment Flow Testing

- [ ] Mark as paid works
- [ ] Cannot mark twice
- [ ] Payment status updates
- [ ] Organizer sees changes
- [ ] Bill completes at 100%

### Edge Cases

- [ ] Bill with 1 participant
- [ ] Bill with 50+ participants
- [ ] Very large amounts (999999.99)
- [ ] Expired/invalid share links
- [ ] Duplicate participant names
- [ ] Special characters in names
- [ ] Network errors (offline)

---

## Performance Testing

### Load Times

```bash
# Lighthouse CLI
npm install -g lighthouse
lighthouse http://localhost:5173 --view
```

### Targets

- Page load: < 3 seconds
- First contentful paint: < 1 second
- Bill creation: < 2 seconds
- Payment confirmation: < 1 second

---

## Coverage Reports

### Generate Report

```bash
npm run test:coverage
```

### View Report

```bash
open coverage/index.html  # macOS
start coverage/index.html # Windows
```

---

## CI/CD Testing

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm install
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v2
```
