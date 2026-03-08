# Class Exploration & Trial Request System - Requirements

## Overview
A public-facing class discovery system that allows parents and prospective students to browse available classes, view detailed information, and request trial classes. Includes an Administrator role with full system access.

## User Roles

### 1. Administrator (New Role)
- **Purpose**: System-wide oversight and management
- **Access Level**: Full access to all data across all classes
- **Responsibilities**:
  - Receive all trial class requests
  - Monitor system activity
  - Manage users and classes
  - Handle administrative tasks

### 2. Parent/Guardian (Existing - Enhanced)
- Browse public class directory
- View detailed class information
- Request trial classes for their children
- Receive notifications about trial requests

### 3. Teacher (Existing - Enhanced)
- Make classes public/private
- Receive trial class requests
- Approve/deny trial requests
- Manage class information for discovery

### 4. Student (Existing)
- Browse classes (with parent)
- Attend trial classes

## Core Features

### 1. Enhanced Class Information

#### Required Fields (for public classes)
- **Basic Info** (already exists):
  - Class name
  - Description
  - Schedule (days/times)
  - Start/end dates

- **New Marketing Fields**:
  - **Who is this class for?** (target audience)
    - Age range (e.g., "Grades 3-5", "Ages 8-10")
    - Skill level (Beginner, Intermediate, Advanced)
    - Prerequisites (if any)
  
  - **What's included?** (syllabus/curriculum)
    - Course topics/modules
    - Learning objectives
    - Materials provided
    - Homework expectations
  
  - **Teacher Information**:
    - Teacher name
    - Teacher bio/qualifications
    - Teaching style/approach
  
  - **Class Details**:
    - Class size (current/max enrollment)
    - Price/cost (if applicable)
    - Duration (weeks/sessions)
    - Location (online/in-person)
  
  - **Media**:
    - Class cover image
    - Additional photos
    - Sample materials/worksheets

#### Optional Fields
- Student testimonials
- Sample lesson preview
- FAQ section
- Related classes

### 2. Public Class Directory

#### Discovery Page (`/classes/explore`)
- **Browse all public classes**
- **Filter by**:
  - Age/grade level
  - Subject area
  - Schedule (day/time)
  - Skill level
  - Teacher
  - Price range
  
- **Search**:
  - By class name
  - By teacher name
  - By topic/keyword

- **Sort by**:
  - Start date (upcoming first)
  - Popularity (enrollment count)
  - Recently added
  - Price (low to high, high to low)

- **Display**:
  - Card view with key info
  - Cover image
  - Quick stats (age range, schedule, spots available)
  - "View Details" and "Request Trial" buttons

### 3. Class Detail Page (Public View)

#### URL: `/classes/[id]/public`
- **Hero Section**:
  - Class cover image
  - Class name
  - Teacher name with photo
  - Key stats (age, level, schedule)
  - Prominent "Request Trial Class" button

- **Sections**:
  1. **Overview**: Description and what students will learn
  2. **Who is this for?**: Target audience details
  3. **What's included?**: Syllabus/curriculum breakdown
  4. **Schedule & Duration**: Detailed timing information
  5. **About the Teacher**: Bio and qualifications
  6. **Class Details**: Size, materials, location
  7. **FAQ** (if provided)

- **Call-to-Action**:
  - Sticky "Request Trial Class" button
  - "Enroll Now" button (if open enrollment)

### 4. Trial Class Request System

#### Request Form
- **Required Information**:
  - Parent/guardian name
  - Parent email
  - Parent phone (optional)
  - Student name
  - Student age/grade
  - Message/questions (optional)
  - Preferred trial date (if applicable)

#### Request Flow
1. Parent fills out trial request form
2. System creates trial request record
3. **Notifications sent to**:
   - Teacher (email notification)
   - Administrator (email notification + in-app)
   - Parent (confirmation email)

4. Teacher/Admin can:
   - Approve request (sends confirmation to parent)
   - Deny request (sends explanation to parent)
   - Request more information
   - Suggest alternative dates

#### Trial Request Management
- **Teacher Dashboard**: View pending trial requests
- **Admin Dashboard**: View all trial requests system-wide
- **Status tracking**: Pending, Approved, Denied, Completed
- **Communication**: In-app messaging for follow-up

### 5. Administrator Role & Dashboard

#### Administrator Permissions
- **Full Data Access**:
  - View all classes (public and private)
  - View all users (teachers, students, parents)
  - View all submissions and challenges
  - View all trial requests
  - Access all analytics

- **Management Capabilities**:
  - Assign/remove roles
  - Approve/deny trial requests
  - Moderate content
  - Manage system settings
  - Export data/reports

#### Admin Dashboard (`/admin`)
- **Overview Stats**:
  - Total users (by role)
  - Total classes (active/inactive)
  - Pending trial requests
  - Recent activity

- **Quick Actions**:
  - View all trial requests
  - Manage users
  - View system logs
  - Generate reports

- **Sections**:
  1. Trial Requests (pending, recent)
  2. User Management
  3. Class Management
  4. System Analytics
  5. Settings

### 6. Notification System

#### Email Notifications
- **Trial Request Submitted** (to parent):
  - Confirmation of request
  - What to expect next
  - Contact information

- **Trial Request Received** (to teacher):
  - Student details
  - Parent contact info
  - Link to approve/deny
  - Message from parent

- **Trial Request Received** (to admin):
  - All request details
  - Teacher information
  - Link to admin dashboard

- **Trial Request Approved** (to parent):
  - Confirmation details
  - Class access information
  - Next steps

- **Trial Request Denied** (to parent):
  - Explanation
  - Alternative suggestions
  - Contact information

#### In-App Notifications
- Badge count for pending requests
- Notification center
- Real-time updates

## Database Schema Changes

### New Tables

#### 1. `trial_requests`
```sql
CREATE TABLE trial_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  parent_name TEXT NOT NULL,
  parent_email TEXT NOT NULL,
  parent_phone TEXT,
  student_name TEXT NOT NULL,
  student_age TEXT NOT NULL,
  message TEXT,
  preferred_date DATE,
  status TEXT CHECK (status IN ('pending', 'approved', 'denied', 'completed')),
  teacher_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES profiles(id)
);
```

#### 2. `notifications`
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Modified Tables

#### `classes` (add new columns)
```sql
ALTER TABLE classes ADD COLUMN IF NOT EXISTS
  is_public BOOLEAN DEFAULT FALSE,
  cover_image_url TEXT,
  target_audience TEXT,
  age_range TEXT,
  skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),
  prerequisites TEXT,
  syllabus TEXT,
  learning_objectives TEXT[],
  materials_provided TEXT,
  homework_expectations TEXT,
  teacher_bio TEXT,
  teaching_style TEXT,
  max_students INTEGER,
  current_students INTEGER DEFAULT 0,
  price DECIMAL(10,2),
  location TEXT,
  faq JSONB;
```

#### `roles` (add administrator)
```sql
INSERT INTO roles (name, description, is_system)
VALUES ('administrator', 'System administrator with full access', TRUE);
```

#### `permissions` (add admin permissions)
```sql
INSERT INTO permissions (name, description, resource, action) VALUES
  ('admin:full_access', 'Full system access', 'system', 'manage'),
  ('trial:view_all', 'View all trial requests', 'trial_requests', 'read'),
  ('trial:manage', 'Manage trial requests', 'trial_requests', 'manage'),
  ('user:manage_all', 'Manage all users', 'users', 'manage'),
  ('class:view_all', 'View all classes', 'classes', 'read');
```

## User Stories

### As a Parent
1. I want to browse available classes so I can find suitable options for my child
2. I want to see detailed class information so I can make an informed decision
3. I want to request a trial class so my child can try before enrolling
4. I want to receive confirmation when I request a trial
5. I want to be notified when my trial request is approved/denied

### As a Teacher
1. I want to make my class public so parents can discover it
2. I want to add detailed information about my class to attract students
3. I want to receive trial requests so I can grow my class
4. I want to approve/deny trial requests based on availability
5. I want to communicate with parents about trial requests

### As an Administrator
1. I want to see all trial requests so I can monitor the system
2. I want to receive notifications for all trial requests
3. I want to view all classes and users for oversight
4. I want to help manage trial requests if needed
5. I want to generate reports on system activity

### As a Student
1. I want to browse classes with my parent
2. I want to see what I'll learn in each class
3. I want to attend a trial class before committing

## Success Criteria

1. **Discovery**: Parents can easily find and browse public classes
2. **Information**: Class pages provide comprehensive, helpful information
3. **Conversion**: Clear path from discovery to trial request
4. **Communication**: All parties receive timely notifications
5. **Management**: Teachers and admins can efficiently handle requests
6. **Oversight**: Administrators have full visibility into the system

## Technical Requirements

1. **Performance**: Class directory loads in < 2 seconds
2. **Responsive**: Works on mobile, tablet, desktop
3. **Accessibility**: WCAG 2.1 AA compliant
4. **SEO**: Public class pages are indexable
5. **Email**: Reliable email delivery for notifications
6. **Security**: Proper RLS for admin access

## Future Enhancements (Out of Scope)

- Payment processing for class enrollment
- Video previews of classes
- Live chat with teachers
- Parent reviews/ratings
- Automated trial class scheduling
- Calendar integration
- SMS notifications
- Multi-language support
