# GoCheck - Split Bill & Payment Tracker

> Making group payments effortless. No awkward chasing. Just simplicity.

## 🎯 What is GoCheck?

GoCheck is a web app that helps groups split bills and track payments without the awkward follow-ups. Perfect for:
- Group meals & dinners
- Event costs & trips
- House bills & utilities
- Sports sessions & activities
- Class fees & community collections

## ✨ Features

✅ **Bill Creation** - Organizers create bills with title, amount, participants, due date  
✅ **Shareable Links** - Generate unique links to share via WhatsApp, email, etc.  
✅ **Payment Tracking** - Members confirm payment with one click  
✅ **Live Dashboard** - See who paid, who hasn't, and payment progress  
✅ **Mobile-First** - Optimized for mobile devices and WhatsApp links  
✅ **Creative Design** - Modern, polished UI with unique branding  

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn
- MongoDB or PostgreSQL

### Setup

```bash
# Clone the repo
git clone https://github.com/daus7768/GoCheck.git
cd GoCheck

# Install dependencies
cd frontend && npm install
cd ../backend && npm install

# Set up environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Start development servers
cd backend && npm run dev
cd ../frontend && npm start
```

Visit `http://localhost:3000` to access the app.

## 📁 Project Structure

```
GoCheck/
├── README.md                 # This file
├── REQUIREMENTS.md           # Detailed requirements checklist
├── ARCHITECTURE.md           # Technical architecture & API docs
├── DESIGN_BRIEF.md           # UI/UX guidelines & theme
├── DEVELOPMENT.md            # Development setup & conventions
├── PROJECT_TRACKER.md        # High-level progress tracking
│
├── frontend/                 # React/Vue frontend
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── styles/
│   │   └── App.tsx
│   ├── public/
│   └── package.json
│
├── backend/                  # Node.js backend
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── models/
│   │   └── middleware/
│   ├── server.ts
│   └── package.json
│
└── docs/
    ├── API.md                # API documentation
    ├── DATABASE_SCHEMA.md    # Database design
    └── DEPLOYMENT.md         # Deployment guide
```

## 🏗️ Architecture Overview

- **Frontend:** React/TypeScript with responsive design
- **Backend:** Node.js/Express REST API
- **Database:** MongoDB/PostgreSQL
- **Hosting:** TBD (Vercel for frontend, Railway/Heroku for backend)
- **Payment Flow:** Simulated (button confirmation, no real gateway)

## 📊 Current Status

**Phase:** Planning & Setup  
**Progress:** Documentation & repo initialization  
**Deadline:** Monday, 1 June 2026, 11:59 PM MYT  
**Reward:** RM500  

## 📚 Documentation

- **[REQUIREMENTS.md](REQUIREMENTS.md)** - Full requirements checklist
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Technical design & API specs
- **[DESIGN_BRIEF.md](DESIGN_BRIEF.md)** - UI/UX theme & guidelines
- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Dev setup & coding guidelines
- **[PROJECT_TRACKER.md](PROJECT_TRACKER.md)** - Phase tracking

## 🤝 Contributing

This is an individual project for a contest submission.

## 📝 License

MIT License - See LICENSE file for details

## 🎉 Ready to Get Started?

Check out the [DEVELOPMENT.md](DEVELOPMENT.md) guide to set up your local environment!
