# Coding Style Guide

## Core Philosophy: Object-Oriented & Component-Based

### Guiding Principles
1. **High Reusability**: Write components and functions that can be reused across the app
2. **Clean Code**: Code should be self-documenting and easy to understand
3. **Single Responsibility**: Each component/function does ONE thing well
4. **DRY (Don't Repeat Yourself)**: If you write the same code twice, extract it
5. **Composition Over Duplication**: Build complex UIs from simple, reusable pieces

### Code Quality Standards
- Write clean, readable, maintainable code
- Prefer explicit over implicit
- Keep functions small and focused (< 50 lines)
- Use meaningful, descriptive names
- Comment WHY, not WHAT (code should explain what it does)
- Think "Can this be reused?" before writing new code

## File Organization (Component-Based Architecture)

```
/src
  /components           # Reusable UI components
    /ui                 # Base UI components (Button, Input, Card)
    /features           # Feature-specific components (DailyChallenge, ClassList)
    /layout             # Layout components (Header, Sidebar, Footer)
  /pages                # Page components/routes
  /lib                  # Utility functions, helpers
    /utils              # Pure utility functions
    /constants          # App constants
  /hooks                # Custom React hooks (if using React)
  /types                # TypeScript types/interfaces
  /services             # API calls, Supabase clients
    /api                # API service layer
    /auth               # Authentication service
    /permissions        # Permission checking service
  /styles               # Global styles, themes
```

### Component Organization Rules
- **ui/**: Generic, highly reusable components (Button, Input, Modal)
- **features/**: Domain-specific components (DailyChallenge, ClassCard)
- **layout/**: Page structure components (Header, Sidebar)
- Each component in its own folder with related files:
  ```
  /components/ui/Button
    ├── Button.tsx          # Component logic
    ├── Button.test.tsx     # Tests
    ├── Button.stories.tsx  # Storybook (optional)
    └── index.ts            # Export
  ```

## Naming Conventions
- **Files**: PascalCase for components (e.g., `DailyChallenge.tsx`), kebab-case for utilities (e.g., `format-date.ts`)
- **Components**: PascalCase (e.g., `DailyChallenge`, `SubmitButton`)
- **Functions**: camelCase, verb-first (e.g., `createChallenge`, `fetchUserData`, `validateInput`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_SUBMISSIONS`, `API_BASE_URL`)
- **Types/Interfaces**: PascalCase with descriptive names (e.g., `ChallengeSubmission`, `UserRole`)
- **Boolean variables**: Prefix with `is`, `has`, `can`, `should` (e.g., `isLoading`, `hasPermission`, `canSubmit`)
- **Event handlers**: Prefix with `handle` (e.g., `handleSubmit`, `handleClick`)

## TypeScript
- Use TypeScript for type safety
- Define interfaces for all data models
- Avoid `any` type unless absolutely necessary
- Use strict mode

## Database Queries
- Use Supabase client consistently
- Always handle errors
- Use TypeScript types for query results
- Keep queries in service files, not components

## Component Design (Critical)
**See [COMPONENT_DESIGN.md](COMPONENT_DESIGN.md) for detailed guidelines**

### Key Rules
1. **Think Reusability First**: Before writing a component, ask "Can this be reused?"
2. **Single Responsibility**: Each component does ONE thing well
3. **Composition**: Build complex UIs from simple, reusable pieces
4. **No Duplication**: If you write similar code twice, extract it into a reusable component
5. **Clear Hierarchy**: Base components (Button) → Composite (FormField) → Features (ChallengeCard) → Pages

### Component Checklist
- [ ] Is this component reusable?
- [ ] Does it have a single, clear purpose?
- [ ] Are props well-named and typed?
- [ ] Is it documented with JSDoc?
- [ ] Does it have tests?
- [ ] Can it be composed with other components?

---

## Error Handling
- Always handle promise rejections
- Provide user-friendly error messages
- Log errors for debugging
- Use try-catch for async operations
- Create reusable error handling utilities

## Testing (CRITICAL - Required Before Deployment)

### Unit Tests (Required)
- **Business logic MUST have unit tests**
- Test all critical functions before deployment
- Focus on:
  - Permission checking logic
  - Data validation
  - Business rules (e.g., "can only see submissions after posting")
  - Edge cases and error conditions
- Use test coverage tools (aim for 80%+ on business logic)
- Mock external dependencies (Supabase, APIs)

### Integration Tests
- Test RLS policies thoroughly with different user roles
- Test API endpoints with real database (test environment)
- Verify permission system works correctly
- Test user flows end-to-end

### Database Tests
- Test all RLS policies with different user contexts
- Verify helper functions work correctly
- Test data integrity constraints
- Use Supabase local development for testing

### Pre-Deployment Checklist
- [ ] All business logic has unit tests
- [ ] All tests pass
- [ ] RLS policies tested with all roles
- [ ] No console errors or warnings
- [ ] Environment variables configured
- [ ] Database migrations applied

## Git Commits
- Use conventional commits format:
  - `feat:` new feature
  - `fix:` bug fix
  - `test:` adding tests
  - `refactor:` code refactoring
  - `docs:` documentation changes
- Keep commits atomic and focused
- Write descriptive commit messages
- Reference issues/tasks when applicable

## Code Review Requirements
- All business logic changes require tests
- No direct commits to main branch
- Use pull requests for review
- Ensure CI/CD passes before merge
