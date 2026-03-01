# Tech Stack & Setup

## Frontend
- **Framework**: Next.js 14+ (React framework with built-in API routes)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/ui (built on Radix UI)
- **State Management**: React Context + Hooks (Zustand if needed later)
- **Forms**: React Hook Form + Zod validation

## Backend
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Authorization**: RBAC (Role-Based Access Control) with RLS
- **Storage**: Supabase Storage (for class materials, recordings)
- **Real-time**: Supabase Realtime (for live updates)
- **API**: Next.js API Routes (Node.js) + Supabase Client

## Development Tools
- **Package Manager**: npm or pnpm
- **Code Quality**: ESLint + Prettier
- **Testing**: Vitest + React Testing Library
- **Git**: GitHub
- **IDE**: VS Code (recommended)

## Deployment
- **Frontend Hosting**: Vercel (2 apps: dev + prod)
- **Backend**: Supabase (2 projects: dev + prod)
- **Domains**: 
  - Dev: henry-math-dev.vercel.app
  - Prod: henry-math-prod.vercel.app (or custom domain)

## Security
- **Row Level Security (RLS)**: REQUIRED on all tables
- **Role-based access control (RBAC)**: Permission-based system
- **Environment Variables**: Stored securely, never committed

## How It Works Together

```
User Browser
    ↓
Next.js Frontend (React + TypeScript + Tailwind)
    ↓
├─> Next.js API Routes (Node.js) [for custom logic]
└─> Supabase Client (JavaScript SDK)
    ↓
Supabase Backend
├─> PostgreSQL Database (with RLS)
├─> Authentication
├─> Storage
└─> Realtime
```

## Environment Variables
```bash
# .env.local (never commit this file!)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Database Access Pattern

### Direct from Frontend (Most Common)
```typescript
// components/DailyChallengeList.tsx
import { supabase } from '@/lib/supabase'

const { data } = await supabase
  .from('daily_challenges')
  .select('*')
// RLS policies automatically enforce permissions!
```

### Via API Route (When Needed)
```typescript
// pages/api/submit-challenge.ts
export default async function handler(req, res) {
  // Custom business logic
  const result = await supabase
    .from('challenge_submissions')
    .insert(req.body)
  
  res.json(result)
}
```

## Why This Stack?

✅ **Fast Development**: Next.js + Supabase = rapid MVP
✅ **Type Safety**: TypeScript everywhere
✅ **Modern UI**: Tailwind + Shadcn/ui = beautiful, accessible components
✅ **Secure**: RLS + RBAC built-in
✅ **Scalable**: Can handle growth
✅ **Free Tier**: Perfect for MVP
✅ **Great DX**: Hot reload, great tooling
✅ **Single Language**: JavaScript/TypeScript for frontend + backend
