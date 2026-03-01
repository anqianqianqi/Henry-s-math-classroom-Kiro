# Henry Math Classroom - Project Overview

## Vision
Build Henry Math Utility App to streamline communication between teacher (Henry), students, and parents, replacing scattered WeChat communications with a centralized platform.

## Current Pain Points
1. All communication between Henry and parents happens through WeChat (unorganized)
2. No class start alerts
3. No class expiration tracking
4. No class introduction page for parents to understand offerings and schedules
5. No centralized place for Henry to upload materials (homework, notes, class recordings)
6. Need to reuse class materials for different student groups

## Priority Feature: Daily Challenge
Henry wants a daily challenge system where:
- He can create challenges for different classes
- Students see the daily challenge in the app
- Students post their thoughts/solutions
- Students can see others' responses AFTER they post (encourages participation)
- Creates a happy community vibe like a blog for discussion
- Challenges are assigned to different student groups based on their scheduled classes

## MVP Scope

### IN SCOPE
- Login (Teacher / Student / Parent)
- Minimal class structure
- Daily question publish
- Submission
- Review

### OUT OF SCOPE (Future)
- Payment
- Course marketplace
- Recording
- AI grading
- Complex notifications

## Non-Negotiables
- Must remain runnable at all times
- RLS (Row Level Security) must be enabled
- No large-scale refactor without approval

## Tech Stack
- Backend: Supabase (PostgreSQL)
- Frontend: Next.js 14+ (TypeScript)
- UI: Tailwind CSS + Shadcn/ui
- Auth: Supabase Auth
- Authorization: RBAC (Role-Based Access Control) with RLS
- API: Next.js API Routes + Supabase Client
- Deployment: Vercel (2 apps) + Supabase (2 projects)

## Authorization Model
- Permission-based system (similar to AWS IAM)
- Predefined permissions (e.g., `class:create`, `challenge:submit`)
- Predefined roles (teacher, student, observer)
- Users can have different roles in different classes
- Flexible and scalable for future needs

## Development Approach
- Component-based architecture with high reusability
- TypeScript for type safety
- Hot reload for instant preview during development
- Test-driven for critical business logic
