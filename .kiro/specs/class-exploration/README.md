# Class Exploration & Trial Request System

## Quick Overview

This spec defines a comprehensive class discovery and trial request system that allows parents to find classes, view detailed information, and request trial sessions. It includes an Administrator role for system oversight.

## Key Features

1. **Public Class Directory** - Browse and search available classes
2. **Enhanced Class Information** - Detailed pages with syllabus, target audience, teacher bios
3. **Trial Request System** - Parents can request trial classes
4. **Notification System** - Email and in-app notifications for all parties
5. **Administrator Role** - New role with full system access
6. **Admin Dashboard** - Oversight and management tools

## User Flows

### Parent Flow
1. Browse public classes at `/classes/explore`
2. Filter by age, skill level, schedule, etc.
3. Click class to view details at `/classes/[id]/public`
4. Click "Request Trial Class" button
5. Fill out trial request form
6. Receive confirmation email
7. Wait for teacher approval
8. Receive approval/denial notification

### Teacher Flow
1. Make class public in class settings
2. Add marketing information (syllabus, target audience, etc.)
3. Receive notification when trial requested
4. Review request in dashboard
5. Approve or deny with optional message
6. Parent receives notification

### Administrator Flow
1. Receive notification for all trial requests
2. View all requests in admin dashboard
3. Monitor system activity
4. Manage users and classes
5. Help with trial request issues if needed

## Implementation Phases

- **Phase 1**: Database & Admin Role (Week 1)
- **Phase 2**: Public Class Discovery (Week 2)
- **Phase 3**: Trial Request System (Week 3)
- **Phase 4**: Admin Dashboard (Week 4)
- **Phase 5**: Notifications (Week 5)
- **Phase 6**: Polish & Testing (Week 6)

## Files

- `requirements.md` - Detailed requirements and user stories
- `design.md` - Technical design and architecture
- `tasks.md` - Implementation tasks broken down by phase

## Next Steps

1. Review and approve the spec
2. Start with Phase 1: Database setup
3. Create administrator role
4. Begin implementing public class directory

## Questions?

- How should we handle class pricing? (Optional field for now)
- Should trial classes be free or paid? (Free for MVP)
- How many trial requests per parent? (Rate limit: 3 per day)
- Who can become an administrator? (Manually assigned by system owner)
