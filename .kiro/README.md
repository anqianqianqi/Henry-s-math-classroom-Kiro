# Henry Math Classroom - Documentation Index

This directory contains modular documentation to help AI agents and developers quickly understand and contribute to the project.

## 📚 Documentation Structure

### For Quick Context
Start here when picking up the project:
1. **[CURRENT_STAGE.md](CURRENT_STAGE.md)** - Where we are now, what's next
2. **[PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)** - Vision, pain points, MVP scope

### For Understanding the System
3. **[TECH_STACK.md](TECH_STACK.md)** - Technologies, setup, environment variables
4. **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Complete database design with RLS policies
5. **[DEVELOPMENT_TIMELINE.md](DEVELOPMENT_TIMELINE.md)** - Phases, milestones, progress tracking

### For Development
6. **[CODING_STYLE.md](CODING_STYLE.md)** - Code conventions, file organization, best practices
7. **[COMPONENT_DESIGN.md](COMPONENT_DESIGN.md)** - Component reusability, design patterns, anti-patterns
8. **[UI_STYLE.md](UI_STYLE.md)** - Design principles, user roles, UI patterns
9. **[DEVELOPMENT_HISTORY.md](DEVELOPMENT_HISTORY.md)** - Decision log, context for changes
10. **[DEPLOYMENT.md](DEPLOYMENT.md)** - Hosting options, deployment workflow, CI/CD

## 🎯 Quick Start for AI Agents

When you're asked to work on this project:

1. Read `CURRENT_STAGE.md` to understand where we are
2. Check `DEVELOPMENT_TIMELINE.md` for what needs to be done
3. Review `TECH_STACK.md` and `DATABASE_SCHEMA.md` for technical context
4. Follow `CODING_STYLE.md` when writing code
5. Update `DEVELOPMENT_HISTORY.md` when making significant decisions
6. Update `CURRENT_STAGE.md` when completing milestones

## 🔑 Key Principles

- **RLS is mandatory** - All database tables must have Row Level Security enabled
- **Keep it runnable** - Don't break existing functionality
- **No big refactors** - Get approval before major architectural changes
- **Modular approach** - Each document has a specific purpose

## 📝 Updating Documentation

When you make changes:
- Update `CURRENT_STAGE.md` with progress
- Add entries to `DEVELOPMENT_HISTORY.md` for major decisions
- Keep `DEVELOPMENT_TIMELINE.md` checkboxes current
- Update relevant technical docs if architecture changes

## 🚀 Project Status

**Current Phase**: Planning & Setup  
**Priority Feature**: Daily Challenge  
**Tech Stack**: Supabase (Backend) + TBD (Frontend)

See `CURRENT_STAGE.md` for detailed status.
