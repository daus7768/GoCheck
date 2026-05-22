# GoCheck Project Tracker

## Project Timeline

**Start Date:** May 22, 2026  
**Deadline:** June 1, 2026, 11:59 PM MYT  
**Status:** Planning Phase  

---

## Phase Breakdown

### ✅ Phase 1: Planning & Setup (May 22 - May 23)

**Deliverables:**
- [x] Repository created on GitHub
- [x] Project documentation initialized
- [x] Team coordination plan
- [x] Tech stack finalized
- [x] Design direction selected
- [x] Database schema designed

**Status:** In Progress

---

### 📋 Phase 2: Backend Foundation (May 23 - May 25)

**Tasks:**
- [ ] Initialize Node.js + Express server
- [ ] Set up database (MongoDB or PostgreSQL)
- [ ] Create Bill model/schema
- [ ] Create Participant model/schema
- [ ] Create Payment model/schema
- [ ] Implement Bill API endpoints:
  - [ ] POST /api/bills (create)
  - [ ] GET /api/bills/:id (get)
  - [ ] PUT /api/bills/:id (update)
  - [ ] DELETE /api/bills/:id (delete)
  - [ ] GET /api/organizer/:id/bills (list)
  - [ ] GET /api/bills/share/:link (public)
- [ ] Implement Payment API endpoints:
  - [ ] POST /api/payments/confirm (mark paid)
  - [ ] GET /api/payments/:billId/status (get status)
- [ ] Implement share link generation
- [ ] Error handling middleware
- [ ] Input validation
- [ ] Basic testing

**Status:** Pending

---

### 🎨 Phase 3: Frontend Setup & Design (May 25 - May 26)

**Tasks:**
- [ ] Initialize React + TypeScript project
- [ ] Set up Tailwind CSS or styled-components
- [ ] Create design system/components
  - [ ] Button component
  - [ ] Input component
  - [ ] Card component
  - [ ] Progress bar component
  - [ ] Modal component
- [ ] Set up routing (React Router)
- [ ] Create layout components
- [ ] Implement dark mode toggle
- [ ] Apply theme/branding
- [ ] Mobile responsive grid

**Status:** Pending

---

### 💼 Phase 4: Core Features - Organizer (May 26 - May 27)

**Tasks:**
- [ ] Bill creation page
  - [ ] Form with all fields
  - [ ] Add/remove participants
  - [ ] Validation
  - [ ] Success confirmation
- [ ] Organizer dashboard
  - [ ] List all bills
  - [ ] Show bill summary (progress, due date)
  - [ ] Quick copy link button
  - [ ] Edit/delete options
- [ ] Detailed bill view (organizer)
  - [ ] View all participants
  - [ ] View payment status
  - [ ] Manual mark paid/unpaid
  - [ ] Share link display
- [ ] API integration for organizer flows
- [ ] Local storage for organizer ID (simple auth)

**Status:** Pending

---

### 👥 Phase 5: Core Features - Members (May 27 - May 28)

**Tasks:**
- [ ] Public bill detail page (shared link)
  - [ ] Display bill info
  - [ ] Show payment progress
  - [ ] List all participants with status
  - [ ] "I've Paid" button
- [ ] Payment confirmation logic
  - [ ] Mark participant as paid
  - [ ] Prevent duplicate confirmations
  - [ ] Show confirmation message
- [ ] Real-time status updates
- [ ] Mobile optimization for shared links
- [ ] Copy organizer contact (optional)

**Status:** Pending

---

### 📊 Phase 6: Progress & Analytics (May 28 - May 29)

**Tasks:**
- [ ] Progress bar component
  - [ ] Visual representation
  - [ ] Percentage calculation
  - [ ] Color coding
  - [ ] Animations
- [ ] Summary statistics
  - [ ] Total collected
  - [ ] Remaining amount
  - [ ] Paid count vs total
  - [ ] Due date countdown
- [ ] Payment status indicators
- [ ] Dashboard statistics

**Status:** Pending

---

### 🎭 Phase 7: Polish & Animations (May 29 - May 30)

**Tasks:**
- [ ] Add button hover/click animations
- [ ] Smooth transitions
- [ ] Loading states
- [ ] Error states
- [ ] Success confirmations
- [ ] Stagger animations on lists
- [ ] Progress bar fill animation
- [ ] Form validation feedback
- [ ] Mobile touch feedback
- [ ] Micro-interactions

**Status:** Pending

---

### ✅ Phase 8: Testing & QA (May 30 - May 31)

**Tasks:**
- [ ] Functional testing (all features)
- [ ] Mobile testing (various devices)
- [ ] Cross-browser testing
- [ ] Performance testing
- [ ] Accessibility testing
- [ ] Error scenario testing
- [ ] Edge cases
- [ ] Fix bugs
- [ ] User experience review

**Status:** Pending

---

### 🚀 Phase 9: Deployment & Final (May 31 - June 1)

**Tasks:**
- [ ] Deploy frontend (Vercel/Netlify)
- [ ] Deploy backend (Railway/Heroku)
- [ ] Configure environment variables
- [ ] Test live deployment
- [ ] Create project README
- [ ] Create API documentation
- [ ] Document deployment process
- [ ] Create project demo/video (optional)
- [ ] Final quality check
- [ ] Prepare submission
- [ ] Submit by deadline

**Status:** Pending

---

## Milestones

| Milestone | Target Date | Status |
|-----------|------------|--------|
| Planning & Setup Complete | May 23 | In Progress |
| Backend APIs Complete | May 25 | Pending |
| Frontend Setup Complete | May 26 | Pending |
| Organizer Features Complete | May 27 | Pending |
| Member Features Complete | May 28 | Pending |
| Progress Tracking Complete | May 29 | Pending |
| Polish & Animations Complete | May 30 | Pending |
| Testing Complete | May 31 | Pending |
| **Submission** | **June 1** | Pending |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Database connection issues | Low | High | Use managed service (MongoDB Atlas, Heroku Postgres) |
| Scope creep | Medium | High | Stick to requirements, avoid extra features |
| Performance issues | Low | Medium | Optimize queries, use caching |
| Mobile responsiveness issues | Low | Medium | Test on multiple devices early |
| API integration bugs | Medium | High | Comprehensive testing of all endpoints |
| Deployment issues | Low | High | Test deployment early, use simple hosting |

---

## Key Success Factors

✅ **Focus on core requirements** - Don't get distracted by bonus features  
✅ **Test frequently** - Catch bugs early  
✅ **Mobile-first approach** - Users will access via WhatsApp  
✅ **Clean code** - Make it maintainable and understandable  
✅ **Good documentation** - Help reviewers understand the project  
✅ **Creative design** - Stand out with unique branding  
✅ **Deliver on time** - Don't miss the deadline  

---

## Team Assignments (If Applicable)

- **Backend Lead:** [TBD]
- **Frontend Lead:** [TBD]
- **Design Lead:** [TBD]
- **QA Lead:** [TBD]

---

## Contact & Communication

- **GitHub Issues:** For tracking bugs and tasks
- **GitHub Discussions:** For architecture decisions
- **Direct Messaging:** For urgent items

---

## Notes

- Keep commits clean and descriptive
- Use feature branches for development
- Review PRs before merging
- Document any major decisions
- Update this tracker regularly
