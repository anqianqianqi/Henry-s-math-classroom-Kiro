# Quick Start Guide

Get Henry's Math Classroom running in 10 minutes!

## Prerequisites

- Node.js 18+ installed
- Supabase account (free)

## Step 1: Install Dependencies (1 min)

```bash
npm install
```

## Step 2: Create Supabase Project (3 min)

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Name: `henry-math-dev`
4. Choose password and region
5. Click "Create new project"
6. Wait for project to be ready (~2 minutes)

## Step 3: Set Up Database (2 min)

**If this is a fresh project:**

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy ALL contents from `supabase/schema.sql`
4. Paste and click **Run**
5. Create another new query
6. Copy ALL contents from `supabase/seed.sql`
7. Paste and click **Run**

**If you're resetting an existing database:**

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy ALL contents from `supabase/cleanup.sql`
4. Paste and click **Run** (this removes everything)
5. Then follow the "fresh project" steps above

## Step 4: Create Storage Buckets (1 min)

1. Go to **Storage** in Supabase dashboard
2. Click "New bucket"
3. Name: `class-materials`, Private, Click "Create"
4. Click "New bucket" again
5. Name: `avatars`, Public, Click "Create"

## Step 5: Get API Keys (1 min)

1. Go to **Settings** → **API**
2. Copy these three values:
   - Project URL
   - `anon` `public` key
   - `service_role` `secret` key

## Step 6: Configure Environment (1 min)

```bash
# Copy example file
cp .env.example .env.local

# Edit .env.local with your values
# Paste the three values from Step 5
```

Your `.env.local` should look like:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Step 7: Run the App (1 min)

```bash
npm run dev
```

Open http://localhost:3000

## Step 8: Create Your Account

1. Click "Sign Up"
2. Fill in:
   - Full Name: Your Name
   - Email: your@email.com
   - Password: (at least 6 characters)
3. Click "Create Account"
4. You're in! 🎉

## Step 9: Assign Teacher Role (Manual)

Since you're the first user (Henry), assign yourself teacher role:

1. Go to Supabase dashboard → **SQL Editor**
2. Run this query:

```sql
-- Get your user ID
SELECT id, email FROM auth.users;

-- Copy your ID, then run (replace YOUR_USER_ID):
INSERT INTO user_roles (user_id, role_id, class_id)
VALUES (
  'YOUR_USER_ID_HERE',
  (SELECT id FROM roles WHERE name = 'teacher'),
  NULL
);
```

## ✅ You're Done!

You now have:
- ✅ Working authentication
- ✅ Database with RBAC
- ✅ Teacher role assigned
- ✅ Ready to create classes

## What's Next?

- Create your first class
- Add students
- Create daily challenges
- Upload materials

## Troubleshooting

### Can't connect to Supabase?
- Check `.env.local` has correct values
- Verify Supabase project is running
- Make sure you copied all three keys

### Sign up not working?
- Check browser console for errors
- Verify database schema was created (check Table Editor)
- Ensure RLS policies are in place

### Need more help?
- See [SETUP.md](SETUP.md) for detailed instructions
- Check [supabase/README.md](supabase/README.md) for database help
- Review `.kiro/` documentation

## Development Commands

```bash
# Start dev server
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Build for production
npm run build
```

---

Happy teaching! 📚✨
