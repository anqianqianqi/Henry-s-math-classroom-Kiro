# Class Exploration & Trial Request System - Tasks

## Phase 1: Database & Admin Role Setup

### 1.1 Create Database Migration File
- [ ] Create `supabase/add-class-exploration.sql`
- [ ] Add trial_requests table
- [ ] Add notifications table
- [ ] Add new columns to classes table
- [ ] Create indexes for performance
- [ ] Test migration on local database

### 1.2 Set Up Administrator Role
- [ ] Add administrator role to roles table
- [ ] Create admin permissions
- [ ] Link permissions to administrator role
- [ ] Create RLS policies for admin access
- [ ] Test admin role permissions

### 1.3 Configure RLS Policies
- [ ] Add trial_requests RLS policies
- [ ] Add notifications RLS policies
- [ ] Update classes RLS for public access
- [ ] Test all RLS policies
- [ ] Document policy behavior

## Phase 2: Public Class Discovery

### 2.1 Update Class Creation/Edit Forms
- [ ] Add "Make Public" toggle to class form
- [ ] Add cover image upload field
- [ ] Add target audience field
- [ ] Add age range field
- [ ] Add skill level dropdown
- [ ] Add syllabus textarea
- [ ] Add learning objectives (array input)
- [ ] Add teacher bio field
- [ ] Add max students field
- [ ] Add price field (optional)
- [ ] Add location field
- [ ] Update form validation
- [ ] Test form submission

### 2.2 Create Class Directory Page (`/classes/explore`)
- [ ] Create page component
- [ ] Fetch public classes from database
- [ ] Implement ClassCard component
- [ ] Add grid layout for class cards
- [ ] Implement pagination (20 per page)
- [ ] Add loading states
- [ ] Add empty state
- [ ] Test responsive design

### 2.3 Implement Class Filters
- [ ] Create ClassFilters component
- [ ] Add age range filter
- [ ] Add skill level filter
- [ ] Add schedule day filter
- [ ] Add price range filter
- [ ] Add search by name/teacher
- [ ] Implement filter logic
- [ ] Add "Clear Filters" button
- [ ] Test filter combinations

### 2.4 Create Public Class Detail Page (`/classes/[id]/public`)
- [ ] Create page component
- [ ] Fetch class data with all fields
- [ ] Create hero section with cover image
- [ ] Add "Who is this for?" section
- [ ] Add "What's included?" section
- [ ] Add schedule section
- [ ] Add teacher bio section
- [ ] Add class details section
- [ ] Add FAQ section (if provided)
- [ ] Add sticky "Request Trial" CTA
- [ ] Test responsive design
- [ ] Add SEO meta tags

## Phase 3: Trial Request System

### 3.1 Create Trial Request Form
- [ ] Create TrialRequestForm component
- [ ] Add parent name field
- [ ] Add parent email field
- [ ] Add parent phone field (optional)
- [ ] Add student name field
- [ ] Add student age/grade field
- [ ] Add message textarea
- [ ] Add preferred date picker
- [ ] Implement form validation
- [ ] Add submit button with loading state
- [ ] Test form submission

### 3.2 Implement Trial Request Creation
- [ ] Create `lib/actions/trial-requests.ts`
- [ ] Implement createTrialRequest action
- [ ] Validate input data
- [ ] Insert trial request record
- [ ] Return success/error response
- [ ] Add error handling
- [ ] Test request creation

### 3.3 Set Up Email Notifications
- [ ] Create `lib/actions/email.ts`
- [ ] Set up email service (Supabase/SendGrid)
- [ ] Create parent confirmation email template
- [ ] Create teacher notification email template
- [ ] Create admin notification email template
- [ ] Implement sendTrialRequestEmail function
- [ ] Test email delivery
- [ ] Handle email failures gracefully

### 3.4 Create Notification System
- [ ] Create `lib/actions/notifications.ts`
- [ ] Implement createNotification action
- [ ] Implement getNotifications action
- [ ] Implement markNotificationRead action
- [ ] Implement markAllNotificationsRead action
- [ ] Test notification CRUD operations

### 3.5 Build Teacher Trial Request Management
- [ ] Add "Trial Requests" tab to teacher dashboard
- [ ] Create TrialRequestCard component
- [ ] Display pending requests
- [ ] Add approve button
- [ ] Add deny button with response field
- [ ] Implement updateTrialRequestStatus action
- [ ] Send notification to parent on status change
- [ ] Test approval/denial flow

## Phase 4: Admin Dashboard

### 4.1 Create Admin Dashboard Layout
- [ ] Create `/app/admin/layout.tsx`
- [ ] Add admin navigation sidebar
- [ ] Add admin header
- [ ] Verify admin role access
- [ ] Redirect non-admins
- [ ] Test access control

### 4.2 Build Admin Overview Page
- [ ] Create `/app/admin/page.tsx`
- [ ] Create AdminStats component
- [ ] Display total users by role
- [ ] Display total classes (active/inactive)
- [ ] Display pending trial requests count
- [ ] Display recent activity
- [ ] Add quick action buttons
- [ ] Test stats calculations

### 4.3 Create Trial Request Management Page
- [ ] Create `/app/admin/trial-requests/page.tsx`
- [ ] Fetch all trial requests
- [ ] Display in table/card format
- [ ] Add status filter (pending/approved/denied)
- [ ] Add date range filter
- [ ] Add class filter
- [ ] Show teacher and parent info
- [ ] Add approve/deny actions
- [ ] Test filtering and actions

### 4.4 Build User Management Page
- [ ] Create `/app/admin/users/page.tsx`
- [ ] Create UserManagementTable component
- [ ] Fetch all users with roles
- [ ] Display user list with search
- [ ] Add role assignment UI
- [ ] Implement role change action
- [ ] Add user deactivation
- [ ] Test user management

### 4.5 Create Class Management Page
- [ ] Create `/app/admin/classes/page.tsx`
- [ ] Fetch all classes (public and private)
- [ ] Display class list with filters
- [ ] Add edit/delete actions
- [ ] Show enrollment stats
- [ ] Add export functionality
- [ ] Test class management

## Phase 5: Notification System UI

### 5.1 Create Notification Bell Component
- [ ] Create NotificationBell component
- [ ] Add bell icon to header
- [ ] Display unread count badge
- [ ] Implement dropdown on click
- [ ] Show recent notifications (last 10)
- [ ] Add "View All" link
- [ ] Add "Mark All Read" button
- [ ] Test dropdown behavior

### 5.2 Build Notification Center Page
- [ ] Create `/app/notifications/page.tsx`
- [ ] Create NotificationList component
- [ ] Fetch all user notifications
- [ ] Display in chronological order
- [ ] Add read/unread styling
- [ ] Implement mark as read on click
- [ ] Add pagination
- [ ] Add filter by type
- [ ] Test notification interactions

### 5.3 Implement Real-Time Updates
- [ ] Set up notification polling (30 seconds)
- [ ] Create NotificationContext
- [ ] Provide context to app
- [ ] Update bell badge in real-time
- [ ] Show toast for new notifications
- [ ] Test real-time behavior

## Phase 6: Integration & Polish

### 6.1 Update Navigation
- [ ] Add "Explore Classes" to main nav
- [ ] Add notification bell to header
- [ ] Add admin link for admins
- [ ] Update footer with new links
- [ ] Test navigation on all pages

### 6.2 Add Trial Request Success Flow
- [ ] Create success page/modal
- [ ] Show confirmation message
- [ ] Display next steps
- [ ] Add "Browse More Classes" button
- [ ] Send confirmation email
- [ ] Test success flow

### 6.3 Implement Rate Limiting
- [ ] Add rate limit for trial requests (3 per email/day)
- [ ] Store rate limit data
- [ ] Show error message when limit reached
- [ ] Test rate limiting

### 6.4 Add Email Templates
- [ ] Create trial request approved email
- [ ] Create trial request denied email
- [ ] Add email styling
- [ ] Test all email templates
- [ ] Verify email deliverability

### 6.5 Performance Optimization
- [ ] Add caching for public class list
- [ ] Optimize images (WebP, lazy loading)
- [ ] Add pagination to class directory
- [ ] Optimize database queries
- [ ] Test page load times

### 6.6 Accessibility & SEO
- [ ] Add ARIA labels to all interactive elements
- [ ] Test keyboard navigation
- [ ] Add meta tags to public pages
- [ ] Create sitemap for public classes
- [ ] Test with screen reader
- [ ] Verify WCAG compliance

### 6.7 Testing
- [ ] Write unit tests for actions
- [ ] Write integration tests for trial flow
- [ ] Write E2E tests for key flows
- [ ] Test on mobile devices
- [ ] Test on different browsers
- [ ] Fix any bugs found

### 6.8 Documentation
- [ ] Document admin role setup
- [ ] Create user guide for teachers
- [ ] Create guide for parents
- [ ] Document email configuration
- [ ] Update README with new features
- [ ] Create deployment guide

## Optional Enhancements (Future)

### Payment Integration
- [ ] Add Stripe integration
- [ ] Implement payment for classes
- [ ] Add refund handling
- [ ] Create payment dashboard

### Advanced Features
- [ ] Add class reviews/ratings
- [ ] Implement live chat with teachers
- [ ] Add video preview uploads
- [ ] Create automated scheduling
- [ ] Add calendar integration
- [ ] Implement SMS notifications

### Analytics
- [ ] Track class views
- [ ] Track trial request conversion
- [ ] Create analytics dashboard
- [ ] Generate reports

## Testing Checklist

### Functional Testing
- [ ] Parent can browse public classes
- [ ] Parent can filter/search classes
- [ ] Parent can view class details
- [ ] Parent can submit trial request
- [ ] Parent receives confirmation email
- [ ] Teacher receives notification
- [ ] Admin receives notification
- [ ] Teacher can approve/deny request
- [ ] Parent receives status update
- [ ] Admin can view all requests
- [ ] Admin can manage users
- [ ] Notifications work correctly

### Security Testing
- [ ] Non-admins cannot access admin pages
- [ ] RLS policies enforce data access
- [ ] Trial requests are rate limited
- [ ] Email addresses are not exposed
- [ ] Input validation prevents injection
- [ ] CSRF protection works

### Performance Testing
- [ ] Class directory loads in < 2s
- [ ] Public class page loads in < 1.5s
- [ ] Notifications update within 30s
- [ ] Images load efficiently
- [ ] Database queries are optimized

### Accessibility Testing
- [ ] All forms are keyboard accessible
- [ ] Screen reader compatible
- [ ] Color contrast meets WCAG AA
- [ ] Focus indicators visible
- [ ] Error messages are clear

## Deployment Steps

1. [ ] Run database migration
2. [ ] Create administrator role
3. [ ] Assign admin role to designated user
4. [ ] Configure email service
5. [ ] Test email delivery
6. [ ] Deploy to staging
7. [ ] Run full test suite
8. [ ] Fix any issues
9. [ ] Deploy to production
10. [ ] Monitor for errors
11. [ ] Verify email notifications
12. [ ] Test trial request flow
13. [ ] Announce new feature
