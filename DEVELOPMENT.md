# Development Guide

## Prerequisites

- **Node.js:** v16 or higher
- **npm:** v7 or higher (or yarn)
- **Git:** Latest version
- **VS Code:** Recommended editor
- **MongoDB or PostgreSQL:** For database

## Project Setup

### 1. Clone Repository

```bash
git clone https://github.com/daus7768/GoCheck.git
cd GoCheck
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Update .env with your values
VITE_API_URL=http://localhost:5000
```

### 3. Backend Setup

```bash
cd ../backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Update .env with your values
PORT=5000
MONGO_URI=mongodb://localhost:27017/gocheck
# OR for PostgreSQL:
DATABASE_URL=postgresql://user:password@localhost:5432/gocheck
```

### 4. Database Setup

#### MongoDB
```bash
# Install MongoDB locally or use MongoDB Atlas
# Create database: gocheck
```

#### PostgreSQL
```bash
# Create database
createdb gocheck

# Run migrations
cd backend
npm run migrate
```

## Development Workflow

### Start Development Servers

**Terminal 1: Backend**
```bash
cd backend
npm run dev
# Server runs on http://localhost:5000
```

**Terminal 2: Frontend**
```bash
cd frontend
npm run dev
# App runs on http://localhost:5173 (Vite)
```

Visit `http://localhost:5173` to access the app.

### File Structure

```
frontend/
├── src/
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── CreateBill.tsx
│   │   ├── BillDetail.tsx
│   │   ├── Dashboard.tsx
│   │   └── 404.tsx
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── Bill/
│   │   │   ├── BillForm.tsx
│   │   │   ├── BillCard.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── ParticipantList.tsx
│   │   ├── Common/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Loading.tsx
│   │   └── Theme/
│   │       └── ThemeToggle.tsx
│   ├── hooks/
│   │   ├── useBill.ts
│   │   ├── usePayment.ts
│   │   └── useDarkMode.ts
│   ├── services/
│   │   ├── api.ts
│   │   ├── billService.ts
│   │   └── paymentService.ts
│   ├── utils/
│   │   ├── formatting.ts
│   │   ├── validation.ts
│   │   └── constants.ts
│   ├── styles/
│   │   ├── tailwind.css
│   │   ├── globals.css
│   │   └── variables.css
│   ├── types/
│   │   ├── bill.ts
│   │   ├── payment.ts
│   │   └── api.ts
│   ├── App.tsx
│   └── main.tsx
├── public/
│   ├── favicon.ico
│   └── images/
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js

backend/
├── src/
│   ├── routes/
│   │   ├── bills.ts
│   │   ├── payments.ts
│   │   ├── links.ts
│   │   └── index.ts
│   ├── controllers/
│   │   ├── billController.ts
│   │   ├── paymentController.ts
│   │   └── linkController.ts
│   ├── models/
│   │   ├── Bill.ts
│   │   ├── Participant.ts
│   │   └── Payment.ts
│   ├── middleware/
│   │   ├── errorHandler.ts
│   │   ├── validation.ts
│   │   └── auth.ts
│   ├── utils/
│   │   ├── db.ts
│   │   ├── logger.ts
│   │   └── generators.ts
│   ├── types/
│   │   ├── index.ts
│   │   └── express.d.ts
│   ├── config/
│   │   └── database.ts
│   ├── server.ts
│   └── index.ts
├── .env.example
├── package.json
├── tsconfig.json
└── .gitignore
```

## Coding Standards

### TypeScript
- Use strict mode (`strict: true` in tsconfig.json)
- Always type function parameters and return values
- Use interfaces for data models
- Avoid `any` type

### React Components
- Use functional components with hooks
- Keep components small and focused
- Use custom hooks for reusable logic
- Props interface per component

```typescript
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onClick,
  variant = 'primary',
  disabled = false,
}) => {
  return (
    <button
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
};
```

### Naming Conventions
- Components: PascalCase (e.g., `BillForm.tsx`)
- Functions/variables: camelCase (e.g., `calculateTotal()`)
- Constants: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
- Files: Match component name or descriptive camelCase

### Error Handling
```typescript
try {
  const response = await fetch(url);
  if (!response.ok) throw new Error('API Error');
  return await response.json();
} catch (error) {
  logger.error('Failed to fetch:', error);
  throw error;
}
```

### API Calls
```typescript
const api = {
  bill: {
    create: (data) => fetch('/api/bills', { method: 'POST', body: JSON.stringify(data) }),
    get: (id) => fetch(`/api/bills/${id}`),
    update: (id, data) => fetch(`/api/bills/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => fetch(`/api/bills/${id}`, { method: 'DELETE' }),
  },
};
```

## Testing

### Frontend Tests
```bash
cd frontend
npm run test
```

### Backend Tests
```bash
cd backend
npm run test
```

### Manual Testing Checklist
- [ ] Create bill with all fields
- [ ] Share bill link works
- [ ] Member marks payment
- [ ] Organizer sees updated status
- [ ] Mobile view works
- [ ] Dark mode toggles
- [ ] Form validation works
- [ ] Error handling works

## Debugging

### Frontend
- Open DevTools (F12)
- Check Console for errors
- Use React DevTools extension
- Network tab for API calls

### Backend
- Check terminal output for logs
- Use `console.log()` or logger
- Use `debugger` keyword and Node debugger
- Check `.env` configuration

## Git Workflow

### Branch Naming
```
feature/bill-creation
feature/payment-tracking
fixbug/payment-confirmation
refactor/api-structure
```

### Commit Messages
```
feat: Add bill creation functionality
fix: Correct payment status calculation
refactor: Simplify API error handling
docs: Update README with setup instructions
```

### Before Committing
```bash
# Format code
npm run format

# Lint code
npm run lint

# Run tests
npm run test
```

## Deployment

### Frontend Deployment (Vercel)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Backend Deployment (Railway/Heroku)
```bash
# Railway
railway link
railway up

# Heroku
heroku login
heroku create gocheck-api
git push heroku main
```

### Environment Variables in Production
- Set via hosting platform dashboard
- Never commit `.env` files
- Use `.env.example` as template

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5000
lsof -ti :5000 | xargs kill -9  # macOS/Linux
netstat -ano | findstr :5000     # Windows
```

### Database Connection Issues
- Check `DATABASE_URL` in `.env`
- Ensure MongoDB/PostgreSQL service is running
- Check network connectivity

### API Not Responding
- Check backend server is running
- Check `VITE_API_URL` in frontend `.env`
- Check CORS configuration in backend

### Build Errors
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear cache: `npm cache clean --force`
- Check TypeScript errors: `npm run type-check`

## Performance Optimization

### Frontend
- Use React.memo for expensive components
- Lazy load pages with React.lazy()
- Code split at route level
- Optimize images

### Backend
- Add database indexes
- Use query optimization
- Implement caching
- Monitor slow queries

## Resources

- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org)
- [Express.js Documentation](https://expressjs.com)
- [MongoDB Documentation](https://docs.mongodb.com)
- [Tailwind CSS Documentation](https://tailwindcss.com)
