# GoCheck Feature Specifications

## Feature List

### MVP (Minimum Viable Product)

#### Core Features
1. **Bill Creation**
   - Organizer creates bill with title, amount, participants, due date
   - Unique share link generated
   - Ability to edit bill before first payment
   - Ability to cancel/delete bill

2. **Payment Confirmation**
   - Members access bill via share link
   - Click "I've Paid" button to confirm
   - Cannot confirm twice (prevents duplicates)
   - Real-time status update

3. **Organizer Dashboard**
   - View all bills created
   - See payment progress for each bill
   - Quick copy share link button
   - Mark bill as complete
   - Delete bill

4. **Payment Tracking**
   - Show who paid, who hasn't
   - Display collected vs remaining amount
   - Visual progress indicator
   - Paid count (e.g., "3/5 paid")

5. **Mobile Responsive**
   - Works on mobile devices
   - Touch-friendly buttons
   - Optimized for WhatsApp links
   - No horizontal scroll

---

## Detailed Feature Specifications

### Feature 1: Bill Creation

**User Story:**
As an organizer, I want to create a bill so that I can track group payments.

**Acceptance Criteria:**
- [ ] I can access bill creation page
- [ ] I can enter bill title (required, 3-100 chars)
- [ ] I can enter total amount (required, > 0)
- [ ] I can select currency (default: MYR)
- [ ] I can set due date (must be future date)
- [ ] I can add description (optional)
- [ ] I can add participants with names and amounts
- [ ] Total of participant amounts must equal bill amount
- [ ] I can remove participants before creating
- [ ] I can edit all fields before creating
- [ ] Form validates on submit
- [ ] Error messages display for invalid data
- [ ] On success, I see confirmation with share link
- [ ] Share link copies to clipboard with one click

**UI Components:**
- Form with fields: title, amount, currency, due date, description
- Participant list with add/remove buttons
- Amount calculator
- Submit and cancel buttons
- Error messages below fields
- Success confirmation with share link

**Validation Rules:**
- Title: required, 3-100 characters, no special characters
- Amount: required, number, > 0, max 9,999,999.99
- Participants: at least 2, all names unique
- Amounts: sum must equal total
- Due date: must be in future

**Error Handling:**
- Show inline validation errors
- Disable submit button if invalid
- Show toast notification on error
- Retry option on server error

---

### Feature 2: Payment Confirmation

**User Story:**
As a group member, I want to confirm my payment via a shared link so I don't need to use complex payment systems.

**Acceptance Criteria:**
- [ ] I receive a bill link via WhatsApp/email
- [ ] I click the link and see bill details
- [ ] I can see payment status of all members
- [ ] I can see total amount and my portion
- [ ] I can click "I've Paid" button
- [ ] I see confirmation message after paying
- [ ] I cannot click "I've Paid" twice
- [ ] Status updates to "Paid" immediately
- [ ] Paid status is persistent
- [ ] I cannot access organizer functions
- [ ] Works on mobile devices
- [ ] Works on desktop browsers

**UI Components:**
- Bill title and description
- Total amount display
- Payment progress bar
- Participant list with status
- "I've Paid" button (changes state)
- Confirmation message
- Back/Home button

**Business Logic:**
- Idempotent: calling mark paid twice = same result
- Payment confirmed in real-time
- Status visible to all viewers immediately
- No session required (stateless)

---

### Feature 3: Organizer Dashboard

**User Story:**
As an organizer, I want to see all my bills and their payment status at a glance.

**Acceptance Criteria:**
- [ ] I see list of all bills I created
- [ ] Each bill shows title, amount, due date
- [ ] Progress bar shows payment status
- [ ] Payment count shows (e.g., "3/5 paid")
- [ ] I can sort by: recent, due date, amount
- [ ] I can filter by: active, completed
- [ ] I can copy share link with one click
- [ ] I can view bill details
- [ ] I can mark bill as complete
- [ ] I can delete bill
- [ ] I can edit bill details (before first payment)
- [ ] Pagination for many bills
- [ ] Search by bill title
- [ ] Empty state message
- [ ] Loading states

**UI Components:**
- Header with "Create Bill" button
- Bill cards in grid/list
- Search and filter controls
- Sort dropdown
- Pagination
- Empty state
- Action buttons: View, Copy Link, Edit, Delete, Complete

**Data Displayed per Bill:**
- Title
- Total amount
- Currency
- Due date
- Status (active/completed)
- Payment progress (1/5 paid)
- Progress bar
- Last updated

---

### Feature 4: Payment Progress Tracking

**User Story:**
As an organizer, I want to see clear progress on bill payments so I know who to follow up with.

**Acceptance Criteria:**
- [ ] I see progress bar showing % collected
- [ ] Progress bar fills with green color
- [ ] I see numerator/denominator of paid count
- [ ] I see amount collected vs total
- [ ] I see remaining amount needed
- [ ] I see which members paid
- [ ] I see which members haven't paid
- [ ] Paid members have checkmark icon
- [ ] Unpaid members have pending icon
- [ ] I can see payment timestamps
- [ ] Progress updates in real-time
- [ ] Status colors: green (paid), gray (pending), yellow (at risk)

**UI Components:**
- Progress bar with animated fill
- Progress percentage text
- Paid count ("3 / 5")
- Amount collected display
- Remaining amount display
- Participant status list
- Status icons (checkmark, clock, alert)

---

### Feature 5: Mobile Responsive Design

**User Story:**
As a mobile user, I want the app to work smoothly on my phone when accessing via WhatsApp links.

**Acceptance Criteria:**
- [ ] All pages responsive at 375px width
- [ ] All pages responsive at 768px width
- [ ] Buttons are at least 44px height (touch friendly)
- [ ] Text is readable without zoom
- [ ] No horizontal scrolling
- [ ] Forms stack vertically
- [ ] Images scale appropriately
- [ ] Works on iPhone and Android
- [ ] Dark mode readable on mobile
- [ ] Payment confirmation easy on mobile
- [ ] Loading states visible on mobile
- [ ] Errors clearly visible on mobile

**Responsive Breakpoints:**
- Mobile: 320px - 640px
- Tablet: 641px - 1024px
- Desktop: 1025px+

---

## Future Features (Phase 2+)

### Phase 2 Enhancements

1. **User Authentication**
   - Simple email/password signup
   - Account dashboard with all bills
   - Payment history
   - Profile settings

2. **Notifications**
   - Email reminders for unpaid bills
   - Payment confirmations
   - Bill completion alerts
   - SMS notifications (optional)

3. **Advanced Payment Tracking**
   - Payment history/receipts
   - Payment notes/comments
   - Partial payments
   - Custom split amounts

4. **Analytics & Reporting**
   - Total collected statistics
   - Average payment time
   - Completion rate
   - Export to PDF/CSV

5. **Social Features**
   - Group management
   - Recurring bills
   - Member invitations
   - Participant comments

### Phase 3 Features

1. **Real Payment Integration**
   - Stripe integration
   - PayPal integration
   - Local payment methods
   - Automated payouts

2. **Advanced Features**
   - Currency conversion
   - Tax calculation
   - Tip splitting
   - Expense notes with photos

3. **Team Management**
   - Multiple organizers
   - Bill approval workflow
   - Team roles and permissions
   - Audit trail

---

## Performance Targets

### Page Load Times
- Home page: < 2 seconds
- Bill creation: < 3 seconds
- Dashboard: < 2 seconds
- Shared bill page: < 1 second
- Payment confirmation: < 500ms

### Lighthouse Scores
- Performance: > 90
- Accessibility: > 90
- Best Practices: > 90
- SEO: > 90

---

## Accessibility Requirements

- [ ] WCAG 2.1 Level AA compliance
- [ ] Color contrast ratio 4.5:1 for text
- [ ] Keyboard navigation for all functions
- [ ] Screen reader compatible
- [ ] Form labels associated with inputs
- [ ] Alt text for images
- [ ] Focus indicators visible
- [ ] Error messages clear
- [ ] No flickering content

---

## Browser Support

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)
- Mobile browsers

---

## Testing Coverage

**Backend:**
- Bill creation and validation
- Payment confirmation logic
- Status calculations
- Share link generation
- API error handling
- Rate limiting

**Frontend:**
- Form submission
- Status updates
- Responsive layout
- Component rendering
- Error states
- Loading states

**E2E:**
- Complete bill creation flow
- Complete payment flow
- Mobile experience
- Cross-browser compatibility
