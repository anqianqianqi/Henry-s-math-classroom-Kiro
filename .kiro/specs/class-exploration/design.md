# Class Exploration & Trial Request System - Design

## Architecture Overview

This feature adds a public-facing class discovery system with trial request capabilities and an administrator role. It integrates with the existing class management system while adding new public views and notification infrastructure.

## System Components

### 1. Database Layer

#### New Tables

**trial_requests**
```sql
CREATE TABLE trial_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  parent_name TEXT NOT NULL,
  parent_email TEXT NOT NULL,
  parent_phone TEXT,
  student_name TEXT NOT NULL,
  student_age TEXT NOT NULL,
  message TEXT,
  preferred_date DATE,
  status TEXT CHECK (status IN ('pending', 'approved', 'denied', 'completed')) DEFAULT 'pending',
  teacher_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_trial_requests_class ON trial_requests(class_id);
CREATE INDEX idx_trial_requests_status ON trial_requests(status);
CREATE INDEX idx_trial_requests_created ON trial_requests(created_at DESC);
```

**notifications**
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
```

#### Modified Tables

**classes** - Add marketing/discovery fields
```sql
ALTER TABLE classes 
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS target_audience TEXT,
  ADD COLUMN IF NOT EXISTS age_range TEXT,
  ADD COLUMN IF NOT EXISTS skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),
  ADD COLUMN IF NOT EXISTS prerequisites TEXT,
  ADD COLUMN IF NOT EXISTS syllabus TEXT,
  ADD COLUMN IF NOT EXISTS learning_objectives TEXT[],
  ADD COLUMN IF NOT EXISTS materials_provided TEXT,
  ADD COLUMN IF NOT EXISTS homework_expectations TEXT,
  ADD COLUMN IF NOT EXISTS teacher_bio TEXT,
  ADD COLUMN IF NOT EXISTS teaching_style TEXT,
  ADD COLUMN IF NOT EXISTS max_students INTEGER,
  ADD COLUMN IF NOT EXISTS current_students INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS faq JSONB;

CREATE INDEX idx_classes_public ON classes(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_classes_age_range ON classes(age_range) WHERE is_public = TRUE;
CREATE INDEX idx_classes_skill_level ON classes(skill_level) WHERE is_public = TRUE;
```

#### New Role & Permissions

```sql
-- Add administrator role
INSERT INTO roles (name, description, is_system)
VALUES ('administrator', 'System administrator with full access', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Add admin permissions
INSERT INTO permissions (name, description, resource, action) VALUES
  ('admin:full_access', 'Full system access', 'system', 'manage'),
  ('trial:view_all', 'View all trial requests', 'trial_requests', 'read'),
  ('trial:manage', 'Manage trial requests', 'trial_requests', 'manage'),
  ('user:manage_all', 'Manage all users', 'users', 'manage'),
  ('class:view_all', 'View all classes', 'classes', 'read'),
  ('notification:send', 'Send notifications', 'notifications', 'create')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to administrator role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'administrator'
  AND p.name IN ('admin:full_access', 'trial:view_all', 'trial:manage', 'user:manage_all', 'class:view_all', 'notification:send')
ON CONFLICT DO NOTHING;
```

#### RLS Policies

```sql
-- Trial requests: Teachers can view requests for their classes
CREATE POLICY "Teachers can view own class trial requests"
  ON trial_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = trial_requests.class_id
        AND classes.created_by = auth.uid()
    )
  );

-- Trial requests: Administrators can view all
CREATE POLICY "Admins can view all trial requests"
  ON trial_requests FOR SELECT
  USING (user_has_permission(auth.uid(), 'trial:view_all'));

-- Trial requests: Teachers can update their class requests
CREATE POLICY "Teachers can update own class trial requests"
  ON trial_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = trial_requests.class_id
        AND classes.created_by = auth.uid()
    )
  );

-- Trial requests: Admins can update all
CREATE POLICY "Admins can update all trial requests"
  ON trial_requests FOR UPDATE
  USING (user_has_permission(auth.uid(), 'trial:manage'));

-- Trial requests: Anyone can create (public form)
CREATE POLICY "Anyone can create trial requests"
  ON trial_requests FOR INSERT
  WITH CHECK (true);

-- Notifications: Users can view their own
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Notifications: Users can update their own (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Notifications: System can create
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (user_has_permission(auth.uid(), 'notification:send'));

-- Classes: Public classes are viewable by anyone
CREATE POLICY "Anyone can view public classes"
  ON classes FOR SELECT
  USING (is_public = TRUE);
```

### 2. API Layer (Server Actions)

#### `/lib/actions/trial-requests.ts`
```typescript
'use server'

export async function createTrialRequest(data: TrialRequestData) {
  // 1. Validate input
  // 2. Create trial request record
  // 3. Send notifications (teacher, admin, parent)
  // 4. Return success/error
}

export async function updateTrialRequestStatus(
  requestId: string, 
  status: 'approved' | 'denied',
  response?: string
) {
  // 1. Verify permissions
  // 2. Update request status
  // 3. Send notification to parent
  // 4. Return success/error
}

export async function getTrialRequests(filters?: {
  classId?: string
  status?: string
}) {
  // 1. Check permissions
  // 2. Fetch requests based on user role
  // 3. Return filtered results
}
```

#### `/lib/actions/notifications.ts`
```typescript
'use server'

export async function createNotification(
  userId: string,
  notification: NotificationData
) {
  // 1. Create notification record
  // 2. Optionally send email
  // 3. Return success/error
}

export async function getNotifications(userId: string) {
  // Fetch user's notifications
}

export async function markNotificationRead(notificationId: string) {
  // Mark as read
}

export async function markAllNotificationsRead(userId: string) {
  // Mark all as read
}
```

#### `/lib/actions/email.ts`
```typescript
'use server'

export async function sendTrialRequestEmail(
  to: string,
  type: 'confirmation' | 'teacher_notification' | 'admin_notification' | 'approved' | 'denied',
  data: EmailData
) {
  // Use Supabase Edge Functions or external email service
  // Send templated email
}
```

### 3. UI Components

#### Page Structure

```
app/
├── classes/
│   ├── explore/
│   │   └── page.tsx              # Public class directory
│   ├── [id]/
│   │   ├── page.tsx              # Existing class detail (for members)
│   │   └── public/
│   │       └── page.tsx          # New public class detail page
│   └── trial-request/
│       └── [classId]/
│           └── page.tsx          # Trial request form
├── admin/
│   ├── page.tsx                  # Admin dashboard
│   ├── trial-requests/
│   │   └── page.tsx              # Trial request management
│   ├── users/
│   │   └── page.tsx              # User management
│   └── classes/
│       └── page.tsx              # Class management
└── notifications/
    └── page.tsx                  # Notification center

components/
├── class/
│   ├── ClassCard.tsx             # Class card for directory
│   ├── ClassFilters.tsx          # Filter sidebar
│   ├── ClassPublicView.tsx       # Public class detail
│   └── TrialRequestForm.tsx      # Trial request form
├── admin/
│   ├── AdminStats.tsx            # Dashboard stats
│   ├── TrialRequestCard.tsx      # Trial request item
│   └── UserManagementTable.tsx   # User table
└── notifications/
    ├── NotificationBell.tsx      # Header notification icon
    ├── NotificationList.tsx      # Notification dropdown
    └── NotificationItem.tsx      # Single notification
```

### 4. Component Designs

#### ClassCard Component
```typescript
interface ClassCardProps {
  class: {
    id: string
    name: string
    description: string
    cover_image_url?: string
    age_range?: string
    skill_level?: string
    schedule: Schedule[]
    teacher: {
      name: string
      avatar?: string
    }
    current_students: number
    max_students: number
    price?: number
  }
}

// Displays:
// - Cover image
// - Class name
// - Teacher name with avatar
// - Age range badge
// - Skill level badge
// - Schedule summary
// - Enrollment status (X/Y spots)
// - Price (if applicable)
// - "View Details" button
// - "Request Trial" button
```

#### ClassPublicView Component
```typescript
interface ClassPublicViewProps {
  class: PublicClassData
}

// Sections:
// 1. Hero: Cover image, title, teacher, CTA
// 2. Overview: Description, key points
// 3. Target Audience: Who is this for?
// 4. Curriculum: What's included?
// 5. Schedule: Detailed timing
// 6. Teacher: Bio and qualifications
// 7. Details: Size, materials, location
// 8. FAQ: Common questions
// 9. Sticky CTA: Request trial button
```

#### TrialRequestForm Component
```typescript
interface TrialRequestFormProps {
  classId: string
  className: string
  onSuccess: () => void
}

// Fields:
// - Parent name (required)
// - Parent email (required)
// - Parent phone (optional)
// - Student name (required)
// - Student age/grade (required)
// - Message/questions (optional)
// - Preferred date (optional)
// - Submit button
// - Cancel button
```

#### NotificationBell Component
```typescript
interface NotificationBellProps {
  userId: string
}

// Features:
// - Badge with unread count
// - Dropdown with recent notifications
// - "View All" link
// - Mark all as read button
// - Real-time updates (polling or websocket)
```

### 5. Email Templates

#### Trial Request Confirmation (to Parent)
```
Subject: Trial Class Request Received - [Class Name]

Hi [Parent Name],

Thank you for your interest in [Class Name]!

We've received your trial class request for [Student Name]. 
The teacher will review your request and get back to you within 24-48 hours.

Class Details:
- Class: [Class Name]
- Teacher: [Teacher Name]
- Schedule: [Schedule]
- Your Message: [Message]

What's Next:
1. The teacher will review your request
2. You'll receive an email when it's approved
3. You'll get access details and next steps

Questions? Reply to this email or contact us at [support email].

Best regards,
Henry's Math Classroom Team
```

#### Trial Request Notification (to Teacher)
```
Subject: New Trial Class Request - [Class Name]

Hi [Teacher Name],

You have a new trial class request!

Student Information:
- Student Name: [Student Name]
- Age/Grade: [Age]
- Parent: [Parent Name]
- Email: [Parent Email]
- Phone: [Phone]
- Preferred Date: [Date]

Message from Parent:
[Message]

[Approve Request Button] [Deny Request Button]

Or manage this request in your dashboard:
[Dashboard Link]

Best regards,
Henry's Math Classroom
```

#### Trial Request Notification (to Admin)
```
Subject: [ADMIN] New Trial Request - [Class Name]

New trial class request received:

Class: [Class Name]
Teacher: [Teacher Name]
Student: [Student Name] (Age: [Age])
Parent: [Parent Name] ([Email])
Status: Pending
Requested: [Timestamp]

[View in Admin Dashboard]

This is an automated notification sent to all administrators.
```

### 6. Navigation Updates

#### Header Navigation
```typescript
// Add to main navigation:
- "Explore Classes" (public, always visible)
- Notification bell (authenticated users)
- Admin link (administrators only)

// Update user menu:
- Dashboard
- My Classes
- Notifications
- Settings
- Admin (if admin)
- Logout
```

#### Footer
```typescript
// Add links:
- Explore Classes
- Become a Teacher
- Help Center
- Contact Us
```

### 7. State Management

#### Context Providers

**NotificationContext**
```typescript
interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  refresh: () => Promise<void>
}

// Provides notification state to entire app
// Polls for new notifications every 30 seconds
```

**AdminContext** (optional)
```typescript
interface AdminContextType {
  isAdmin: boolean
  stats: AdminStats
  refreshStats: () => Promise<void>
}

// Provides admin-specific state
```

### 8. Routing & Access Control

#### Public Routes (no auth required)
- `/classes/explore` - Class directory
- `/classes/[id]/public` - Public class detail
- `/classes/trial-request/[classId]` - Trial request form

#### Protected Routes (auth required)
- `/notifications` - Notification center
- `/admin/*` - Admin pages (admin role only)

#### Middleware
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  // Check admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Verify admin role
    // Redirect if not admin
  }
}
```

### 9. Performance Considerations

#### Caching Strategy
- Public class list: Cache for 5 minutes
- Class detail pages: Cache for 10 minutes
- Notifications: No cache (real-time)
- Admin stats: Cache for 1 minute

#### Image Optimization
- Use Next.js Image component
- Lazy load images in class directory
- Optimize cover images (WebP format)
- Responsive images for different screen sizes

#### Database Optimization
- Index on `is_public` for fast public class queries
- Index on trial request status for dashboard
- Pagination for class directory (20 per page)
- Limit notification queries (last 50)

### 10. Security Considerations

#### Input Validation
- Sanitize all form inputs
- Validate email format
- Rate limit trial request submissions (max 3 per email per day)
- CSRF protection on forms

#### Data Privacy
- Don't expose parent contact info publicly
- Admin access logged
- Trial requests only visible to teacher/admin
- Email addresses never shown in public views

#### RLS Enforcement
- All database queries go through RLS
- Admin role properly configured
- Public class queries filtered by `is_public`
- Trial requests filtered by ownership

### 11. Testing Strategy

#### Unit Tests
- Trial request creation
- Notification creation
- Email sending
- Permission checks

#### Integration Tests
- Full trial request flow
- Admin dashboard access
- Public class discovery
- Notification delivery

#### E2E Tests
- Parent requests trial class
- Teacher approves/denies request
- Admin views all requests
- Notifications appear correctly

### 12. Deployment Checklist

1. Run database migrations
2. Create administrator role and permissions
3. Assign admin role to designated user(s)
4. Configure email service (Supabase Edge Functions or SendGrid)
5. Set up notification polling interval
6. Test trial request flow end-to-end
7. Verify RLS policies
8. Test admin dashboard access
9. Monitor email delivery
10. Set up error tracking for notifications

## Implementation Phases

### Phase 1: Database & Admin Role (Week 1)
- Create new tables
- Add columns to classes table
- Create administrator role
- Set up RLS policies
- Create admin user

### Phase 2: Public Class Discovery (Week 2)
- Build class directory page
- Implement filters and search
- Create public class detail page
- Add cover image upload to class creation

### Phase 3: Trial Request System (Week 3)
- Build trial request form
- Implement request creation
- Set up email notifications
- Create teacher request management UI

### Phase 4: Admin Dashboard (Week 4)
- Build admin dashboard
- Create trial request management
- Add user management
- Implement system stats

### Phase 5: Notifications (Week 5)
- Build notification system
- Create notification bell component
- Implement notification center
- Set up real-time updates

### Phase 6: Polish & Testing (Week 6)
- UI/UX improvements
- Performance optimization
- Comprehensive testing
- Bug fixes
- Documentation

## Success Metrics

1. **Adoption**: 50% of teachers make classes public within 1 month
2. **Engagement**: 100+ trial requests in first month
3. **Conversion**: 30% of trial requests convert to enrollments
4. **Response Time**: Teachers respond to requests within 24 hours
5. **Satisfaction**: 4.5+ star rating from parents
