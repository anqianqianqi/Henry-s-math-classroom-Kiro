# Project Map - Henry's Math Classroom

Visual guide to understanding the project structure and flow.

---

## 🗺️ Project Structure

```
henry-math-classroom/
│
├── 📱 FRONTEND (Next.js 14)
│   ├── app/                          # Pages & Routes
│   │   ├── page.tsx                  # Home page (landing)
│   │   ├── layout.tsx                # Root layout
│   │   ├── globals.css               # Global styles
│   │   ├── login/page.tsx            # Login page
│   │   ├── signup/page.tsx           # Sign up page
│   │   ├── dashboard/page.tsx        # Dashboard (protected)
│   │   └── auth/signout/route.ts     # Sign out API
│   │
│   ├── components/                   # React Components
│   │   └── ui/                       # Base UI Components
│   │       ├── Button.tsx            # Reusable button
│   │       ├── Input.tsx             # Reusable input
│   │       ├── Card.tsx              # Reusable card
│   │       └── FormField.tsx         # Form field composite
│   │
│   ├── lib/                          # Utilities
│   │   └── supabase/                 # Supabase clients
│   │       ├── client.ts             # Client component client
│   │       └── server.ts             # Server component client
│   │
│   └── types/                        # TypeScript Types
│       └── database.ts               # Database type definitions
│
├── 🗄️ DATABASE (Supabase/PostgreSQL)
│   └── supabase/
│       ├── schema.sql                # Complete database schema
│       ├── seed.sql                  # Initial data (roles, permissions)
│       └── README.md                 # Database setup guide
│
├── 📚 DOCUMENTATION
│   ├── .kiro/                        # Project documentation
│   │   ├── PROJECT_OVERVIEW.md       # Vision & requirements
│   │   ├── TECH_STACK.md             # Technology choices
│   │   ├── DATABASE_SCHEMA.md        # Database design
│   │   ├── COMPONENT_DESIGN.md       # Component architecture
│   │   ├── CODING_STYLE.md           # Code standards
│   │   ├── DEPLOYMENT.md             # Deployment guide
│   │   ├── IMPLEMENTATION_PROGRESS.md # Current status
│   │   └── SESSION_SUMMARY.md        # What we built
│   │
│   ├── README.md                     # Project overview
│   ├── QUICKSTART.md                 # 10-minute setup
│   ├── SETUP.md                      # Detailed setup
│   ├── TODO.md                       # Task checklist
│   ├── PROJECT_STATUS.md             # Current status
│   └── PROJECT_MAP.md                # This file
│
└── ⚙️ CONFIGURATION
    ├── package.json                  # Dependencies
    ├── tsconfig.json                 # TypeScript config
    ├── next.config.js                # Next.js config
    ├── tailwind.config.ts            # Tailwind config
    ├── .eslintrc.json                # ESLint config
    ├── .env.example                  # Environment template
    └── .gitignore                    # Git ignore rules
```

---

## 🔄 User Flow

### Authentication Flow
```
┌─────────────┐
│  Home Page  │
│   (/)        │
└──────┬──────┘
       │
       ├─────────────┐
       │             │
       ▼             ▼
┌──────────┐  ┌──────────┐
│  Login   │  │  Sign Up │
│ /login   │  │ /signup  │
└────┬─────┘  └────┬─────┘
     │             │
     └──────┬──────┘
            │
            ▼
     ┌─────────────┐
     │  Dashboard  │
     │ /dashboard  │
     │ (protected) │
     └─────────────┘
```

### Data Flow
```
┌──────────────┐
│   Browser    │
│  (User)      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Next.js     │
│  Frontend    │
└──────┬───────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│  Supabase    │  │  Next.js     │
│  Client      │  │  API Routes  │
│  (Direct)    │  │  (Custom)    │
└──────┬───────┘  └──────┬───────┘
       │                 │
       └────────┬────────┘
                │
                ▼
         ┌──────────────┐
         │  Supabase    │
         │  Backend     │
         │  (Database)  │
         └──────────────┘
```

---

## 🎨 Component Hierarchy

```
┌─────────────────────────────────────────┐
│         Level 1: Base (Atoms)           │
│  Button, Input, Card, Badge, Avatar     │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│      Level 2: Composite (Molecules)     │
│   FormField, SearchBar, UserCard        │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│      Level 3: Feature (Organisms)       │
│  ChallengeCard, ClassList, SubmissionFeed│
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│       Level 4: Pages (Templates)        │
│  Dashboard, ChallengePage, ClassPage    │
└─────────────────────────────────────────┘
```

---

## 🗃️ Database Schema Overview

```
┌──────────────────────────────────────────────┐
│              RBAC SYSTEM                     │
├──────────────────────────────────────────────┤
│  permissions → role_permissions → roles      │
│       ↓                              ↓       │
│  user_roles ← users → class_members          │
└──────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌─────────────┐ ┌──────────┐ ┌──────────────┐
│   classes   │ │challenges│ │  materials   │
└─────────────┘ └────┬─────┘ └──────────────┘
                     │
                     ▼
              ┌──────────────┐
              │ submissions  │
              └──────────────┘
```

### Key Tables
- **permissions**: What actions can be done (e.g., 'class:create')
- **roles**: Collections of permissions (teacher, student, observer)
- **user_roles**: Assigns roles to users (global or per-class)
- **classes**: Class information
- **class_members**: Who's in which class
- **daily_challenges**: Challenge content
- **challenge_submissions**: Student responses
- **class_materials**: Uploaded files

---

## 🔐 Permission System

```
User → user_roles → role → role_permissions → permission
                      ↓
                  class_id (optional)
```

### Example: Student Viewing Submissions
```
1. Student submits challenge
2. System checks: user_has_submitted(user_id, challenge_id)
3. If TRUE → Show all submissions
4. If FALSE → Show "Post to see others" message
```

### Example: Teacher Creating Class
```
1. Teacher clicks "Create Class"
2. System checks: user_has_permission(user_id, 'class:create')
3. If TRUE → Allow creation
4. If FALSE → Show error
```

---

## 📦 Feature Modules (Planned)

### Phase 2: Class Management
```
/app/classes/
├── page.tsx              # List all classes
├── new/page.tsx          # Create new class
└── [id]/
    ├── page.tsx          # View class details
    ├── edit/page.tsx     # Edit class
    └── members/page.tsx  # Manage members
```

### Phase 3: Daily Challenge
```
/app/challenges/
├── page.tsx              # List challenges
├── new/page.tsx          # Create challenge
├── [id]/
│   ├── page.tsx          # View challenge
│   └── submissions/      # View submissions
└── today/page.tsx        # Today's challenge
```

### Phase 4: Materials
```
/app/materials/
├── page.tsx              # List materials
├── upload/page.tsx       # Upload material
└── [id]/page.tsx         # View/download material
```

---

## 🚀 Deployment Architecture

```
┌─────────────────────────────────────────┐
│           GitHub Repository             │
│                                         │
│  ┌─────────┐         ┌─────────┐      │
│  │   dev   │         │  main   │      │
│  │ branch  │         │ branch  │      │
│  └────┬────┘         └────┬────┘      │
└───────┼──────────────────┼────────────┘
        │                  │
        │                  │
        ▼                  ▼
┌──────────────┐    ┌──────────────┐
│  Vercel Dev  │    │ Vercel Prod  │
│     App      │    │     App      │
└──────┬───────┘    └──────┬───────┘
       │                   │
       ▼                   ▼
┌──────────────┐    ┌──────────────┐
│  Supabase    │    │  Supabase    │
│  Dev Project │    │ Prod Project │
└──────────────┘    └──────────────┘
```

---

## 🎯 Development Workflow

### Adding a New Feature
```
1. Create feature branch
   git checkout -b feature/new-feature

2. Build the feature
   - Create components in /components
   - Create pages in /app
   - Update database if needed

3. Test locally
   npm run dev

4. Commit changes
   git commit -m "feat: add new feature"

5. Push to dev
   git push origin feature/new-feature
   (merge to dev branch)

6. Test on dev deployment
   https://henry-math-dev.vercel.app

7. Merge to main (production)
   git checkout main
   git merge dev
   git push origin main
```

---

## 📊 Current Implementation Status

### ✅ Completed (Green)
```
[████████████████████] Database Schema
[████████████████████] Authentication
[████████████████████] Base Components
[████████████████████] Configuration
```

### 🚧 In Progress (Yellow)
```
[████████░░░░░░░░░░░░] Phase 1 (60%)
```

### ⏳ Not Started (Gray)
```
[░░░░░░░░░░░░░░░░░░░░] Class Management
[░░░░░░░░░░░░░░░░░░░░] Daily Challenge
[░░░░░░░░░░░░░░░░░░░░] Materials
[░░░░░░░░░░░░░░░░░░░░] Notifications
```

---

## 🔍 Where to Find Things

### Need to...
- **Understand the project?** → Read `README.md`
- **Get it running?** → Follow `QUICKSTART.md`
- **See what's done?** → Check `PROJECT_STATUS.md`
- **Know what to do next?** → See `TODO.md`
- **Understand the database?** → Read `.kiro/DATABASE_SCHEMA.md`
- **Learn component patterns?** → Read `.kiro/COMPONENT_DESIGN.md`
- **Follow code standards?** → Read `.kiro/CODING_STYLE.md`
- **Deploy the app?** → Read `.kiro/DEPLOYMENT.md`

### Working on...
- **Authentication?** → `app/login/`, `app/signup/`, `app/auth/`
- **UI components?** → `components/ui/`
- **Database?** → `supabase/schema.sql`
- **Types?** → `types/database.ts`
- **Supabase client?** → `lib/supabase/`

---

## 🎓 Learning Path

### For New Developers
1. **Day 1**: Read README.md and PROJECT_OVERVIEW.md
2. **Day 1**: Follow QUICKSTART.md to get running
3. **Day 2**: Read COMPONENT_DESIGN.md and CODING_STYLE.md
4. **Day 2**: Explore the codebase (start with app/page.tsx)
5. **Day 3**: Pick a task from TODO.md
6. **Day 3**: Build your first feature

### For Understanding the Architecture
1. Read TECH_STACK.md
2. Review DATABASE_SCHEMA.md
3. Study supabase/schema.sql
4. Explore component hierarchy in components/ui/
5. Understand data flow in lib/supabase/

---

## 💡 Quick Reference

### Commands
```bash
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Build for production
npm run lint         # Run linter
npm test             # Run tests (when added)
```

### URLs (Local)
- Home: http://localhost:3000
- Login: http://localhost:3000/login
- Sign Up: http://localhost:3000/signup
- Dashboard: http://localhost:3000/dashboard

### Important Files
- Environment: `.env.local`
- Database: `supabase/schema.sql`
- Types: `types/database.ts`
- Config: `next.config.js`

---

**This map is your guide to navigating the project. Bookmark it!** 🗺️
