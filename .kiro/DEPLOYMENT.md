# Deployment Guide

## Hosting Options (Free Tier Available)

### Frontend Hosting

#### Vercel (Recommended)
- **Free Tier**: Generous limits, perfect for MVP
- **Features**: 
  - Automatic deployments from Git
  - Preview deployments for PRs
  - Edge functions
  - Custom domains
  - Analytics
- **Best For**: Next.js, React, Vue, static sites
- **Limits**: 100GB bandwidth/month, 100 builds/day
- **URL**: https://vercel.com

#### Netlify
- **Free Tier**: Good for small projects
- **Features**:
  - Continuous deployment
  - Form handling
  - Serverless functions
  - Split testing
- **Best For**: Static sites, JAMstack apps
- **Limits**: 100GB bandwidth/month, 300 build minutes/month
- **URL**: https://netlify.com

#### Cloudflare Pages
- **Free Tier**: Unlimited bandwidth!
- **Features**:
  - Unlimited bandwidth
  - Unlimited requests
  - Fast global CDN
  - Preview deployments
- **Best For**: Static sites, full-stack apps
- **Limits**: 500 builds/month, 20,000 files per site
- **URL**: https://pages.cloudflare.com

#### Railway
- **Free Tier**: $5 credit/month
- **Features**:
  - Full-stack deployments
  - Database hosting
  - Environment variables
  - Custom domains
- **Best For**: Full-stack apps with backend
- **Limits**: $5 credit/month (can run small apps)
- **URL**: https://railway.app

#### Render
- **Free Tier**: Available with limitations
- **Features**:
  - Static sites (free)
  - Web services (free with spin-down)
  - PostgreSQL databases (free 90 days)
  - Automatic SSL
- **Best For**: Full-stack apps
- **Limits**: Services spin down after 15 min inactivity
- **URL**: https://render.com

---

## Backend (Supabase)

### Supabase Hosting
- **Free Tier**: 500MB database, 1GB file storage, 2GB bandwidth
- **Features**:
  - PostgreSQL database
  - Authentication
  - Storage
  - Real-time subscriptions
  - Edge functions
- **Limits**: 
  - 500MB database storage
  - 1GB file storage
  - 2GB bandwidth/month
  - 50,000 monthly active users
- **URL**: https://supabase.com

---

## Recommended Stack for Henry's App

### Option 1: Vercel + Supabase (Recommended)
- **Frontend**: Vercel (Next.js)
- **Backend**: Supabase
- **Cost**: Free for MVP
- **Pros**: 
  - Best developer experience
  - Automatic deployments
  - Great performance
  - Easy to scale

### Option 2: Cloudflare Pages + Supabase
- **Frontend**: Cloudflare Pages
- **Backend**: Supabase
- **Cost**: Free for MVP
- **Pros**:
  - Unlimited bandwidth
  - Global CDN
  - Very fast
  - Good for high traffic

### Option 3: Netlify + Supabase
- **Frontend**: Netlify
- **Backend**: Supabase
- **Cost**: Free for MVP
- **Pros**:
  - Simple setup
  - Good for static sites
  - Built-in form handling

---

## Deployment Strategy

### Two-App Approach (Dev + Prod)

We use **2 separate Vercel apps** with **branch-based deployments**:

```
Repository: henry-math-classroom
├── dev branch → Dev App (henry-math-dev.vercel.app)
└── main branch → Prod App (henry-math.vercel.app)
```

**Workflow**:
1. Develop on feature branches
2. Merge feature → `dev` branch (auto-deploys to Dev App)
3. Test on Dev App
4. When ready, merge `dev` → `main` (auto-deploys to Prod App)

---

## Setting Up Automatic Deployment

### Step 1: Create Two Supabase Projects

1. **Dev Project**: `henry-math-dev`
   - URL: `https://xxx-dev.supabase.co`
   - For testing and development

2. **Prod Project**: `henry-math-prod`
   - URL: `https://xxx-prod.supabase.co`
   - For real users (Henry, students, parents)

### Step 2: Push Code to GitHub

```bash
# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit"

# Create dev and main branches
git branch dev
git branch main

# Push to GitHub
git remote add origin https://github.com/your-username/henry-math-classroom.git
git push -u origin dev
git push -u origin main
```

### Step 3: Create Dev App in Vercel

1. Go to https://vercel.com
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. **Configure Dev App**:
   - **Project Name**: `henry-math-dev`
   - **Framework**: Next.js (or your framework)
   - **Root Directory**: `./` (or your frontend folder)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next` (or `dist`)
   - **Production Branch**: `dev` ⚠️ Important!
   
5. **Add Environment Variables** (Dev):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxx-dev.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-dev-service-key
   NEXT_PUBLIC_APP_URL=https://henry-math-dev.vercel.app
   ```

6. Click "Deploy"

### Step 4: Create Prod App in Vercel

1. Go back to Vercel dashboard
2. Click "Add New" → "Project"
3. Import the **SAME** GitHub repository again
4. **Configure Prod App**:
   - **Project Name**: `henry-math-prod`
   - **Framework**: Next.js (or your framework)
   - **Root Directory**: `./` (same as dev)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next` (same as dev)
   - **Production Branch**: `main` ⚠️ Important!
   
5. **Add Environment Variables** (Prod):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxx-prod.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-prod-service-key
   NEXT_PUBLIC_APP_URL=https://henry-math-prod.vercel.app
   ```

6. Click "Deploy"

### Step 5: Configure Branch Settings (Important!)

**For Dev App**:
1. Go to Project Settings → Git
2. **Production Branch**: Set to `dev`
3. **Ignored Build Step**: Leave empty (deploy all commits)

**For Prod App**:
1. Go to Project Settings → Git
2. **Production Branch**: Set to `main`
3. **Ignored Build Step**: Leave empty (deploy all commits)

---

## How Automatic Deployment Works

### Development Workflow

```bash
# 1. Create feature branch
git checkout dev
git checkout -b feature/daily-challenge

# 2. Make changes and commit
git add .
git commit -m "feat: add daily challenge feature"

# 3. Push to GitHub
git push origin feature/daily-challenge

# 4. Create Pull Request to dev branch
# → Vercel creates preview deployment automatically

# 5. Merge PR to dev
# → Dev App auto-deploys! 🚀

# 6. Test on Dev App (henry-math-dev.vercel.app)
```

### Production Deployment

```bash
# When dev is stable and tested:

# 1. Create PR from dev to main
git checkout main
git pull origin main
# On GitHub: Create PR from dev → main

# 2. Review changes

# 3. Merge PR to main
# → Prod App auto-deploys! 🚀

# 4. Monitor Prod App (henry-math-prod.vercel.app)
```

---

## Deployment Checklist

### Before Merging to Dev
- [ ] Code works locally
- [ ] All tests pass (`npm test`)
- [ ] No console errors
- [ ] Linting passes (`npm run lint`)

### Before Merging to Prod
- [ ] Tested thoroughly on Dev App
- [ ] All critical features work
- [ ] Database migrations applied to Prod Supabase
- [ ] Environment variables correct
- [ ] No breaking changes
- [ ] Stakeholders approved (Henry reviewed)

---

## Environment Variables

### Required for Deployment
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Setting Up in Vercel
1. Go to Project Settings → Environment Variables
2. Add each variable
3. Select environments (Production, Preview, Development)
4. Redeploy if needed

---

## CI/CD Pipeline (Optional - Not Required)

### GitHub Actions (Optional)
If you want automated testing before deployment:

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run lint
```

**Note**: Vercel handles deployment automatically. GitHub Actions is only needed if you want to run tests before allowing merges.

---

## Quick Reference

### URLs
- **Dev App**: https://henry-math-dev.vercel.app
- **Prod App**: https://henry-math-prod.vercel.app (or custom domain)
- **Dev Supabase**: https://xxx-dev.supabase.co
- **Prod Supabase**: https://xxx-prod.supabase.co

### Git Branches
- `dev` → Deploys to Dev App
- `main` → Deploys to Prod App
- `feature/*` → Creates preview deployments

### Deployment Commands
```bash
# Deploy to Dev
git checkout dev
git merge feature/your-feature
git push origin dev
# → Auto-deploys to Dev App

# Deploy to Prod
git checkout main
git merge dev
git push origin main
# → Auto-deploys to Prod App
```

### Rollback (if something breaks)
1. Go to Vercel dashboard
2. Select the app (dev or prod)
3. Go to "Deployments"
4. Find previous working deployment
5. Click "..." → "Promote to Production"

---

## Monitoring & Logging

### Free Options
- **Vercel Analytics**: Built-in, free
- **Sentry**: Error tracking (free tier: 5k events/month)
- **LogRocket**: Session replay (free tier: 1k sessions/month)
- **Supabase Logs**: Built-in database logs

---

## Scaling Considerations

### When to Upgrade from Free Tier
- Database > 500MB
- Bandwidth > 100GB/month
- Need faster builds
- Need more team members
- Need advanced features

### Cost Estimates (When Scaling)
- **Vercel Pro**: $20/month
- **Supabase Pro**: $25/month
- **Total**: ~$45/month for production-ready setup

---

## Backup Strategy

### Database Backups
- Supabase Pro includes daily backups
- Free tier: Manual exports via dashboard
- Use `pg_dump` for local backups

### File Storage Backups
- Download from Supabase Storage
- Consider separate backup service for critical files

---

## Security Checklist

- [ ] Environment variables not in code
- [ ] RLS enabled on all tables
- [ ] HTTPS enforced
- [ ] CORS configured correctly
- [ ] API keys rotated regularly
- [ ] Dependencies updated
- [ ] Security headers configured
