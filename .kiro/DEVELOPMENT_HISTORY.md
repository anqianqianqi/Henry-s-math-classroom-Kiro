# Development History

## Purpose
This file tracks major decisions, changes, and context for AI agents to understand the project evolution.

---

## 2026-03-01: Project Initialization & Tech Stack Finalized
**Context**: Starting Henry Math Classroom project

**Decisions Made**:
- Chose Supabase as backend (PostgreSQL + Auth + Storage)
- Chose Next.js 14+ as frontend framework
- Chose Tailwind CSS + Shadcn/ui for UI
- Prioritized Daily Challenge feature as MVP
- Decided on modular documentation structure
- Established RLS as non-negotiable requirement
- Implemented RBAC (Role-Based Access Control) system similar to AWS IAM
- Decided on 2-app deployment strategy (dev + prod)

**Rationale**:
- Supabase provides all-in-one solution (DB, Auth, Storage, Realtime)
- Next.js includes Node.js API routes (no separate backend needed)
- Supabase JavaScript client eliminates need to write SQL manually
- Daily Challenge addresses Henry's most urgent need
- Modular docs help AI agents pick up context efficiently
- RLS ensures data security from the start
- RBAC provides flexible, granular permission control
- Permission-based approach allows users to have different roles in different classes
- Avoids hardcoding user types (student/parent/teacher) in profiles
- Tailwind + Shadcn/ui provides beautiful, accessible, reusable components
- TypeScript for type safety across frontend and backend

**Architecture Decisions**:
- Users are just users (no hardcoded role in profile)
- Permissions are granular (e.g., `class:create`, `challenge:submit`)
- Roles are collections of permissions (teacher, student, observer)
- Users can have global roles or class-specific roles
- Same user can be student in one class, observer in another
- Component-based architecture with high reusability focus
- 4-level component hierarchy: Base → Composite → Feature → Page

**Tech Stack**:
- Frontend: Next.js 14+ (TypeScript) + Tailwind CSS + Shadcn/ui
- Backend: Supabase (PostgreSQL + Auth + Storage + Realtime)
- API: Next.js API Routes + Supabase Client
- Deployment: Vercel (2 apps) + Supabase (2 projects)
- Development: Hot reload with npm run dev

**Next Steps**:
- Commit planning docs to GitHub
- Create Supabase projects (dev + prod)
- Initialize Next.js project
- Implement database schema with RLS policies
- Set up authentication flow

---

## Template for Future Entries

### YYYY-MM-DD: [Title]
**Context**: [What was happening]

**Decisions Made**:
- [Decision 1]
- [Decision 2]

**Rationale**:
- [Why decision 1]
- [Why decision 2]

**Code Changes**:
- [File/module affected]
- [What changed]

**Next Steps**:
- [What to do next]

---

## Notes for AI Agents
- Always read this file before making major changes
- Add entries when making significant decisions
- Include rationale to help future agents understand context
- Reference related files and specs
