# Henry's Math Classroom

A modern web application for math education, connecting teachers, students, and parents.

## 🎯 Project Overview

Henry's Math Classroom is an MVP platform designed to centralize communication and learning activities between teacher (Henry), students, and parents. The priority feature is a Daily Challenge system where students post solutions and see others' responses after posting, creating an engaging learning community.

## ✨ Key Features

- **Daily Challenges**: Interactive math problems with community discussion
- **Class Management**: Create and manage multiple classes
- **Material Sharing**: Upload and access homework, notes, and recordings
- **Role-Based Access**: Teacher, Student, and Observer (parent) roles
- **Secure Authentication**: Email/password authentication with Supabase

## 🚀 Quick Start

See [SETUP.md](SETUP.md) for detailed setup instructions.

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

Open http://localhost:3000

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (React, TypeScript)
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Styling**: Tailwind CSS
- **Authorization**: RBAC with Row Level Security (RLS)
- **Deployment**: Vercel + Supabase

## 📁 Project Structure

```
├── app/                 # Next.js pages and routes
├── components/          # Reusable React components
├── lib/                 # Utility functions and Supabase clients
├── supabase/            # Database schema and migrations
├── types/               # TypeScript type definitions
└── .kiro/               # Project documentation
```

## 📚 Documentation

Comprehensive documentation is available in the `.kiro/` directory:

- [PROJECT_OVERVIEW.md](.kiro/PROJECT_OVERVIEW.md) - Vision and requirements
- [TECH_STACK.md](.kiro/TECH_STACK.md) - Technology choices
- [DATABASE_SCHEMA.md](.kiro/DATABASE_SCHEMA.md) - Database design
- [COMPONENT_DESIGN.md](.kiro/COMPONENT_DESIGN.md) - Component architecture
- [CODING_STYLE.md](.kiro/CODING_STYLE.md) - Code standards
- [DEPLOYMENT.md](.kiro/DEPLOYMENT.md) - Deployment guide
- [IMPLEMENTATION_PROGRESS.md](.kiro/IMPLEMENTATION_PROGRESS.md) - Current status

## 🎨 Component Architecture

The project follows a 4-level component hierarchy:

1. **Base Components** (Atoms): Button, Input, Card
2. **Composite Components** (Molecules): FormField, SearchBar
3. **Feature Components** (Organisms): ChallengeCard, ClassList
4. **Page Components** (Templates): Dashboard, ChallengePage

See [COMPONENT_DESIGN.md](.kiro/COMPONENT_DESIGN.md) for details.

## 🔐 Security

- Row Level Security (RLS) enabled on all database tables
- Permission-based access control (RBAC)
- Secure authentication with Supabase Auth
- Environment variables for sensitive data

## 🧪 Testing

```bash
# Run tests
npm test

# Run linter
npm run lint
```

## 📈 Development Status

**Current Phase**: Phase 1 - Foundation (In Progress)

### Completed
- ✅ Project setup and configuration
- ✅ Database schema with RBAC
- ✅ Base UI components
- ✅ Authentication pages
- ✅ Basic dashboard

### In Progress
- 🚧 Class management
- 🚧 Daily challenge feature
- 🚧 Material upload system

See [IMPLEMENTATION_PROGRESS.md](.kiro/IMPLEMENTATION_PROGRESS.md) for detailed status.

## 🤝 Contributing

1. Follow the coding style guide in [CODING_STYLE.md](.kiro/CODING_STYLE.md)
2. Write tests for business logic
3. Ensure RLS policies are tested
4. Keep the app runnable at all times

## 📝 License

Private project for Henry's Math Classroom.

## 🔗 Links

- [Supabase Dashboard](https://supabase.com/dashboard)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [Next.js Documentation](https://nextjs.org/docs)

---

Built with ❤️ for math education
