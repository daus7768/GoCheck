# GoCheck Requirements Checklist

## Core Functionality

### 1. Bill Creation ✓
- [ ] Organizer can create a new bill
- [ ] Bill form includes:
  - [ ] Title/Name
  - [ ] Total amount
  - [ ] List of participants (add/remove)
  - [ ] Due date
  - [ ] Description (optional)
- [ ] Validation on all fields
- [ ] Error handling for invalid inputs
- [ ] Success confirmation after creation
- [ ] Ability to edit bill before sharing
- [ ] Ability to delete bill

### 2. Shareable Bill Page ✓
- [ ] Generate unique URL for each bill
- [ ] Public bill detail page accessible via link
- [ ] No authentication required to view bill
- [ ] Display bill information:
  - [ ] Title and amount
  - [ ] Due date
  - [ ] Description
  - [ ] List of participants
  - [ ] Payment status indicators
- [ ] Easy copy-to-clipboard link button
- [ ] QR code option for sharing (bonus)

### 3. Member Payment Confirmation ✓
- [ ] Members can view bill details via shared link
- [ ] Simple UI to mark payment
- [ ] "I've Paid" button/action
- [ ] Confirmation feedback after marking paid
- [ ] Prevent duplicate payment claims (if same person opens link multiple times)
- [ ] Visual confirmation they are marked as paid

### 4. Organizer Dashboard ✓
- [ ] Organizer login/access to their bills
- [ ] List all bills created by organizer
- [ ] For each bill, show:
  - [ ] Bill title and amount
  - [ ] Due date
  - [ ] Creation date
  - [ ] Quick view of payment status
  - [ ] Option to view detailed bill
- [ ] Quick copy link to share bill
- [ ] Mark bill as complete
- [ ] Edit bill details
- [ ] Delete bill

### 5. Payment Status Tracking ✓
- [ ] Real-time view of who paid and who hasn't
- [ ] Display each participant with their payment status (paid/unpaid)
- [ ] Total amount collected vs remaining
- [ ] Number of paid participants vs total
- [ ] Option to manually adjust status (admin override)

### 6. Payment Progress Display ✓
- [ ] Visual progress bar
- [ ] Percentage collected
- [ ] Amount remaining
- [ ] Headcount (3/5 paid, etc.)
- [ ] Color coding (green for complete, yellow for in-progress, red for at-risk)
- [ ] Estimated completion based on due date

## User Experience

### Organizer Flow
1. Land on app
2. Create new bill
3. Fill bill details
4. Add participants
5. Generate shareable link
6. Copy and share link (via WhatsApp, email, etc.)
7. View dashboard tracking progress
8. See notifications/status updates
9. Mark bill as complete

### Member Flow
1. Receive bill link (via WhatsApp, email, etc.)
2. Click link
3. View bill details
4. Click "I've Paid" button
5. See confirmation
6. Done!

## Design & Creativity

### Visual Design
- [ ] Clean, modern UI
- [ ] Consistent color scheme
- [ ] Readable typography
- [ ] Proper spacing and alignment
- [ ] Professional appearance

### Theme & Branding
- [ ] Choose unique visual direction (fintech, casual, premium, makan, etc.)
- [ ] Custom logo/branding
- [ ] Unique color palette
- [ ] Consistent iconography

### Interactive Elements
- [ ] Smooth animations
- [ ] Micro-interactions (hover, click feedback)
- [ ] Loading states
- [ ] Error states
- [ ] Success confirmations

### Bonus Features
- [ ] Dark mode support
- [ ] Animations on progress bar
- [ ] Participant avatars/initials
- [ ] Payment reminders/notifications
- [ ] Export bill summary (PDF/image)
- [ ] Multiple currency support
- [ ] Split customization (not equal split)
- [ ] Payment history
- [ ] Admin comments/notes

## Technical Requirements

### Frontend
- [ ] Responsive design (mobile-first)
- [ ] Works on all modern browsers
- [ ] Mobile optimization for WhatsApp/email links
- [ ] Performance optimized (fast load times)
- [ ] Accessibility basics (WCAG compliance)

### Backend
- [ ] Secure API endpoints
- [ ] Input validation
- [ ] Error handling
- [ ] Database schema designed properly
- [ ] Unique bill link generation
- [ ] Data persistence

### Deployment
- [ ] App accessible on public URL
- [ ] Mobile-friendly when opened via link
- [ ] Works on desktop and mobile
- [ ] Error handling in production

## Submission Requirements

- [ ] GitHub repository with clean code
- [ ] All source code included
- [ ] README with setup instructions
- [ ] Project description and overview
- [ ] Live demo link (deployed)
- [ ] No real payment gateway required (simulated is fine)
- [ ] All requirements met
- [ ] Submitted by deadline: Monday, 1 June 2026, 11:59 PM MYT

## Success Metrics

✅ Can create bill with all required fields  
✅ Can share bill link and access publicly  
✅ Can mark payment and see confirmation  
✅ Dashboard shows accurate payment status  
✅ Mobile-friendly and works on WhatsApp links  
✅ Visually appealing with creative theme  
✅ Code on GitHub  
✅ Deployed and accessible  
