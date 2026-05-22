# GoCheck Deployment Guide

## Deployment Architecture

```
┌─────────────────────────────────────┐
│   Frontend (Vercel/Netlify)         │
│   - React app                       │
│   - Static hosting                  │
│   - CDN/SSL included               │
└──────────────┬──────────────────────┘
               │ API calls (HTTPS)
               ▼
┌─────────────────────────────────────┐
│   Backend (Railway/Heroku)          │
│   - Node.js + Express               │
│   - RESTful API                     │
│   - Auto-deploy on git push         │
└──────────────┬──────────────────────┘
               │ Connection pool
               ▼
┌─────────────────────────────────────┐
│   Database (MongoDB Atlas / PG)     │
│   - Managed database                │
│   - Backups included                │
│   - Monitoring included             │
└─────────────────────────────────────┘
```

---

## Frontend Deployment (Vercel)

### Prerequisites

- GitHub account with repository
- Vercel account (free tier available)

### Step 1: Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Select GitHub and authorize
4. Select `GoCheck` repository
5. Click "Import"

### Step 2: Configure Build Settings

```
Framework: Vite (or Next.js if using that)
Root Directory: ./frontend
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

### Step 3: Environment Variables

Add in Vercel Dashboard under Settings → Environment Variables:

```
VITE_API_URL=https://api.gocheck.com
VITE_APP_NAME=GoCheck
VITE_ENV=production
```

### Step 4: Deploy

```bash
# Push to main branch triggers automatic deploy
git push origin main
```

### Step 5: Custom Domain (Optional)

1. Go to Vercel Dashboard → Settings → Domains
2. Add custom domain
3. Update DNS records with Vercel nameservers

### Vercel CLI Alternative

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd frontend
vercel

# Deploy to production
vercel --prod
```

---

## Backend Deployment (Railway)

### Prerequisites

- Railway account (free tier available)
- GitHub account with repository

### Step 1: Create New Project

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Authorize GitHub
5. Select `GoCheck` repository

### Step 2: Configure Railway

Railway auto-detects Node.js projects. Create `railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "nixpacks",
    "buildCommand": "npm install && npm run build"
  },
  "deploy": {
    "startCommand": "npm run start"
  }
}
```

### Step 3: Add Database

1. In Railway Dashboard → "Add Plugin"
2. Select "PostgreSQL" or "MongoDB"
3. Railway generates `DATABASE_URL` automatically

### Step 4: Environment Variables

Add in Railway Dashboard → Variables:

```
PORT=5000
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/gocheck
CORS_ORIGIN=https://gocheck.vercel.app
JWT_SECRET=your_secret_key_here
LOG_LEVEL=info
```

### Step 5: Deploy

```bash
# Automatic on git push to main
git push origin main

# Monitor in Railway Dashboard
```

### Railway CLI Alternative

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy
railway deploy

# View logs
railway logs
```

---

## Backend Deployment (Heroku)

### Prerequisites

- Heroku account (paid required for production)
- Heroku CLI installed

### Step 1: Setup Heroku

```bash
# Install Heroku CLI
brew tap heroku/brew && brew install heroku
# or npm i -g heroku

# Login
heroku login

# Create app
heroku create gocheck-api
```

### Step 2: Add Database

```bash
# Add PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Get connection string
heroku config:get DATABASE_URL
```

### Step 3: Environment Variables

```bash
heroku config:set PORT=5000
heroku config:set NODE_ENV=production
heroku config:set CORS_ORIGIN=https://gocheck.vercel.app
heroku config:set JWT_SECRET=your_secret_key_here
```

### Step 4: Deploy

```bash
# Add Heroku remote
heroku git:remote -a gocheck-api

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

---

## Database Deployment

### MongoDB Atlas

1. Go to [mongodb.com](https://www.mongodb.com/cloud/atlas)
2. Create cluster
3. Create database user
4. Get connection string
5. Add to backend `.env`:

```
DATABASE_URL=mongodb+srv://user:password@cluster.mongodb.net/gocheck?retryWrites=true&w=majority
```

### PostgreSQL (Managed)

Use Railway or Heroku's managed PostgreSQL (easier than self-hosted)

---

## Pre-Deployment Checklist

### Backend

- [ ] All tests passing locally
- [ ] No console.log() in production code
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Error handling in place
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] Logging configured
- [ ] Health check endpoint working
- [ ] API documentation updated

### Frontend

- [ ] All tests passing
- [ ] No hardcoded localhost URLs
- [ ] Environment variables used correctly
- [ ] Build succeeds without warnings
- [ ] Bundle size acceptable
- [ ] No console errors
- [ ] Mobile tested
- [ ] Dark mode tested
- [ ] Performance acceptable
- [ ] Analytics configured (if needed)

---

## Post-Deployment Verification

### Backend Health

```bash
# Check API is running
curl https://api.gocheck.com/health

# Should return: { "status": "ok" }
```

### Frontend Access

```bash
# Check site loads
curl -I https://gocheck.vercel.app

# Should return 200 OK
```

### End-to-End Test

1. Open app in browser
2. Create test bill
3. Copy share link
4. Open in private window
5. Mark as paid
6. Verify in dashboard

### Monitoring

- [ ] Check Vercel dashboard for errors
- [ ] Check Railway/Heroku logs
- [ ] Monitor database performance
- [ ] Check error tracking (Sentry if configured)

---

## Rollback Procedure

### Vercel

1. Go to Dashboard → Deployments
2. Select previous successful deployment
3. Click "Promote to Production"

### Railway

1. Go to Deployments tab
2. Select previous deployment
3. Click "Redeploy"

### Heroku

```bash
heroku releases
heroku releases:rollback v123
```

---

## Continuous Deployment

### GitHub Actions (Auto-Deploy)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy Frontend
        run: |
          npm install -g vercel
          vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
      
      - name: Deploy Backend
        run: |
          git push heroku main
        env:
          HEROKU_API_KEY: ${{ secrets.HEROKU_API_KEY }}
```

---

## Security Checklist

- [ ] HTTPS enabled
- [ ] Secrets not in code
- [ ] Environment variables configured
- [ ] CORS restricted to known domains
- [ ] Input validation enabled
- [ ] SQL injection prevention
- [ ] XSS protection headers
- [ ] CSRF tokens if needed
- [ ] Rate limiting enabled
- [ ] API keys rotated
- [ ] Backups automated
- [ ] Monitoring alerts set

---

## Performance Optimization

### Frontend

```javascript
// Optimize build
npm run build

// Check bundle size
npm run build -- --analyze

// Enable compression in Vercel (automatic)
```

### Backend

```javascript
// Connection pooling
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000
});

// Caching
app.use(compression());
app.set('etag', 'strong');
```

---

## Troubleshooting

### Frontend Won't Deploy

```bash
# Check build locally
cd frontend
npm run build

# Check environment variables
echo $VITE_API_URL

# Check Vercel logs
vercel logs
```

### Backend Won't Start

```bash
# Check logs
heroku logs --tail
# or
railway logs

# Check environment variables
heroku config
# or
railway variables

# Restart
heroku restart
# or
railway restart
```

### Database Connection Failed

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check DATABASE_URL format
echo $DATABASE_URL
```

---

## Cost Estimation

### Free Tier (Suitable for MVP)

- **Vercel:** Free (Pro: $20/month)
- **Railway:** Free tier limited, ~$5-20/month for small apps
- **MongoDB Atlas:** Free tier (512MB)
- **PostgreSQL:** Free with Railway/Heroku
- **Total:** ~$5-25/month for small traffic

### Paid Tier (Growth)

- **Vercel Pro:** $20/month
- **Railway:** $5-50/month
- **MongoDB Atlas:** $9+/month
- **Total:** $35-70+/month

---

## Monitoring Setup

### Health Checks

```javascript
// backend/src/routes/health.ts
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});
```

### Error Tracking (Optional)

```typescript
// Install Sentry
npm install @sentry/node

import * as Sentry from "@sentry/node";

Sentry.init({ dsn: process.env.SENTRY_DSN });
```

---

## Maintenance

### Weekly

- Check error logs
- Monitor performance
- Test payment flow

### Monthly

- Update dependencies
- Review security logs
- Backup verification
- Performance analysis

### Quarterly

- Security audit
- Dependency updates
- Performance optimization
- Capacity planning
