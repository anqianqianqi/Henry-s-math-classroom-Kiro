# Henry's Math Classroom - Setup Guide

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account (free tier)
- Git

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

#### Create Supabase Project
1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Name: `henry-math-dev` (for development)
4. Choose a secure database password
5. Select your region
6. Click "Create new project"

#### Run Database Schema
1. Open Supabase dashboard → SQL Editor
2. Copy contents of `supabase/schema.sql`
3. Paste and click "Run"
4. Verify tables are created in Table Editor

#### Seed Initial Data
1. In SQL Editor, create new query
2. Copy contents of `supabase/seed.sql`
3. Paste and click "Run"
4. Verify:
   - `permissions` table has 16 rows
   - `roles` table has 3 rows (teacher, student, observer)
   - `role_permissions` table has mappings

#### Configure Storage
1. Go to Storage in Supabase dashboard
2. Create bucket: `class-materials` (Private, 50MB limit)
3. Create bucket: `avatars` (Public, 2MB limit)

#### Get API Keys
1. Go to Settings → API
2. Copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key

### 3. Configure Environment Variables

Create `.env.local` file in project root:

```bash
# Copy from .env.example
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### 5. Create Your First User

1. Go to http://localhost:3000/signup
2. Fill in the form:
   - Full Name: Your name
   - Email: your@email.com
   - Password: (at least 6 characters)
3. Click "Create Account"
4. You'll be redirected to the dashboard

### 6. Assign Teacher Role (Manual Step)

Since this is the first user (Henry), assign teacher role manually:

1. Go to Supabase dashboard → SQL Editor
2. Run this query (replace with your user ID):

```sql
-- Get your user ID first
SELECT id, email FROM auth.users;

-- Assign teacher role globally (replace USER_ID)
INSERT INTO user_roles (user_id, role_id, class_id)
VALUES (
  'YOUR_USER_ID_HERE',
  (SELECT id FROM roles WHERE name = 'teacher'),
  NULL  -- NULL means global teacher role
);
```

## Project Structure

```
henry-math-classroom/
├── app/                      # Next.js app directory
│   ├── auth/                 # Auth routes
│   ├── dashboard/            # Dashboard page
│   ├── login/                # Login page
│   ├── signup/               # Sign up page
│   ├── globals.css           # Global styles
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Home page
├── components/               # React components
│   └── ui/                   # Base UI components
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── FormField.tsx
│       └── Input.tsx
├── lib/                      # Utility functions
│   └── supabase/             # Supabase clients
│       ├── client.ts         # Client component client
│       └── server.ts         # Server component client
├── supabase/                 # Database files
│   ├── schema.sql            # Database schema
│   ├── seed.sql              # Seed data
│   └── README.md             # Supabase setup guide
├── types/                    # TypeScript types
│   └── database.ts           # Database types
├── .env.example              # Environment variables template
├── .env.local                # Your local environment (not in git)
├── package.json              # Dependencies
└── README.md                 # Project overview
```

## What's Implemented

### ✅ Phase 1 - Foundation (Partial)
- [x] Next.js 14 project with TypeScript
- [x] Tailwind CSS configuration
- [x] Supabase client setup
- [x] Database schema with RBAC
- [x] RLS policies
- [x] Base UI components (Button, Input, Card, FormField)
- [x] Authentication pages (Login, Sign Up)
- [x] Basic dashboard
- [ ] Git repository setup
- [ ] Vercel deployment

### 🚧 Next Steps
1. Test authentication flow
2. Create class management pages
3. Implement daily challenge feature
4. Add material upload functionality

## Testing the Setup

### Test Database Connection
```typescript
// In browser console or test file
const supabase = createClient()
const { data, error } = await supabase.from('roles').select('*')
console.log('Roles:', data) // Should show 3 roles
```

### Test Authentication
1. Sign up with a new account
2. Verify you're redirected to dashboard
3. Sign out
4. Sign in with same credentials
5. Verify you're back in dashboard

### Test RLS Policies
1. Try querying tables without authentication
2. Should get empty results or errors
3. Sign in and query again
4. Should see data based on your permissions

## Troubleshooting

### "Module not found" errors
```bash
npm install
```

### Supabase connection errors
- Check `.env.local` has correct values
- Verify Supabase project is running
- Check API keys are correct

### RLS policy errors
- Verify RLS is enabled on all tables
- Check user has proper role assignments
- Review policy conditions in `schema.sql`

### Build errors
```bash
# Clear Next.js cache
rm -rf .next
npm run dev
```

## Development Workflow

### Making Changes
1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes
3. Test locally: `npm run dev`
4. Commit: `git commit -m "feat: your feature"`
5. Push: `git push origin feature/your-feature`

### Database Changes
1. Update `supabase/schema.sql`
2. Create migration file: `supabase/migrations/YYYYMMDD_description.sql`
3. Test in dev Supabase project
4. Apply to prod after testing

### Adding New Components
Follow the component hierarchy in `.kiro/COMPONENT_DESIGN.md`:
1. Base components → `components/ui/`
2. Composite components → `components/ui/`
3. Feature components → `components/features/`
4. Page components → `app/`

## Next Features to Implement

### Phase 2: Core Features
- Class management (CRUD)
- Student enrollment
- Material upload system
- Class introduction pages

### Phase 3: Daily Challenge
- Challenge creation (teacher)
- Challenge view (student)
- Submission system
- "Post to see others" logic
- Discussion view

### Phase 4: Polish
- Notifications
- UI/UX improvements
- Testing
- Deployment

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Project Documentation](.kiro/)

## Getting Help

1. Check `.kiro/` documentation
2. Review `supabase/README.md` for database issues
3. Check Supabase dashboard logs
4. Review browser console for errors

## Production Deployment

See `.kiro/DEPLOYMENT.md` for detailed deployment instructions using Vercel and Supabase.
