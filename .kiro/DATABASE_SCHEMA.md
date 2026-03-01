# Database Schema Design

## Overview
This document defines the Supabase database schema with RLS policies using RBAC (Role-Based Access Control) similar to AWS IAM.

---

## RBAC System

### permissions (predefined system permissions)
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
name            text UNIQUE NOT NULL  -- e.g., 'class:create', 'challenge:submit'
description     text
resource        text NOT NULL  -- e.g., 'class', 'challenge', 'material'
action          text NOT NULL  -- e.g., 'create', 'read', 'update', 'delete', 'submit'
created_at      timestamptz DEFAULT now()
```

**Predefined Permissions**:
- `class:create` - Create new classes
- `class:read` - View class details
- `class:update` - Edit class information
- `class:delete` - Delete classes
- `challenge:create` - Create daily challenges
- `challenge:read` - View challenges
- `challenge:submit` - Submit challenge responses
- `challenge:update` - Edit challenges
- `challenge:delete` - Delete challenges
- `material:upload` - Upload class materials
- `material:read` - View/download materials
- `material:delete` - Delete materials
- `submission:read_all` - View all student submissions
- `submission:read_own` - View own submissions
- `submission:read_after_post` - View others' submissions after posting own
- `member:manage` - Add/remove class members

---

### roles (predefined system roles)
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
name            text UNIQUE NOT NULL  -- e.g., 'teacher', 'student', 'observer'
description     text
is_system       boolean DEFAULT true  -- System roles vs custom roles
created_at      timestamptz DEFAULT now()
```

**Predefined Roles**:
- `teacher` - Full control over their classes
- `student` - Can participate and submit work
- `observer` - Read-only access (for parents)

---

### role_permissions (maps permissions to roles)
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
role_id         uuid REFERENCES roles(id) ON DELETE CASCADE
permission_id   uuid REFERENCES permissions(id) ON DELETE CASCADE
created_at      timestamptz DEFAULT now()
UNIQUE(role_id, permission_id)
```

**Default Mappings**:

**Teacher Role**:
- class:create, class:read, class:update, class:delete
- challenge:create, challenge:read, challenge:update, challenge:delete
- material:upload, material:read, material:delete
- submission:read_all
- member:manage

**Student Role**:
- class:read
- challenge:read, challenge:submit
- material:read
- submission:read_own, submission:read_after_post

**Observer Role**:
- class:read
- challenge:read
- material:read
- submission:read_own (if linked to a student)

---

## User Tables

### profiles
```sql
id              uuid PRIMARY KEY REFERENCES auth.users(id)
full_name       text NOT NULL
email           text NOT NULL
avatar_url      text
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

**RLS Policies**:
- Users can read their own profile
- Users can update their own profile
- Users with `class:read` permission can read profiles of class members

---

### user_roles (assigns roles to users)
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid REFERENCES profiles(id) ON DELETE CASCADE
role_id         uuid REFERENCES roles(id) ON DELETE CASCADE
class_id        uuid REFERENCES classes(id) ON DELETE CASCADE NULL  -- NULL = global role
assigned_at     timestamptz DEFAULT now()
assigned_by     uuid REFERENCES profiles(id)
UNIQUE(user_id, role_id, class_id)
```

**Notes**:
- `class_id = NULL` means global role (e.g., Henry is a teacher globally)
- `class_id = <uuid>` means role is scoped to specific class
- A user can have multiple roles in different classes

**RLS Policies**:
- Users can read their own role assignments
- Users with `member:manage` permission can manage roles in their classes

---

### classes
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
created_by      uuid REFERENCES profiles(id) NOT NULL
name            text NOT NULL
description     text
schedule        jsonb  -- Store class schedule info
start_date      date
end_date        date
is_active       boolean DEFAULT true
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

**RLS Policies**:
- Users with `class:create` permission can create classes
- Users with `class:read` permission can read classes they're members of
- Users with `class:update` permission can update classes they're members of
- Users with `class:delete` permission can delete classes they created

---

### class_members (replaces class_enrollments)
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
class_id        uuid REFERENCES classes(id) ON DELETE CASCADE
user_id         uuid REFERENCES profiles(id) ON DELETE CASCADE
role_id         uuid REFERENCES roles(id) NOT NULL
joined_at       timestamptz DEFAULT now()
added_by        uuid REFERENCES profiles(id)
UNIQUE(class_id, user_id, role_id)
```

**Notes**:
- A user can have multiple roles in the same class (e.g., both student and observer)
- This table determines what permissions a user has within a specific class

**RLS Policies**:
- Users can read their own memberships
- Users with `member:manage` permission can manage memberships in their classes
- Users with `class:read` permission can see other members in their classes

---

### user_relationships (for parent-student links, etc.)
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid REFERENCES profiles(id) ON DELETE CASCADE
related_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE
relationship    text NOT NULL CHECK (relationship IN ('parent', 'guardian', 'sibling'))
created_at      timestamptz DEFAULT now()
UNIQUE(user_id, related_user_id, relationship)
```

**Notes**:
- Optional table for tracking family relationships
- Allows observers to see related users' submissions

**RLS Policies**:
- Users can read their own relationships
- Users can create relationships (pending approval)
- Related users can confirm relationships

---

### daily_challenges
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
created_by      uuid REFERENCES profiles(id) NOT NULL
title           text NOT NULL
description     text NOT NULL
challenge_date  date NOT NULL
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

**RLS Policies**:
- Users with `challenge:create` permission can create challenges
- Users with `challenge:read` permission can read challenges assigned to their classes
- Users with `challenge:update` permission can update challenges they created
- Users with `challenge:delete` permission can delete challenges they created

---

### challenge_assignments
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
challenge_id    uuid REFERENCES daily_challenges(id) ON DELETE CASCADE
class_id        uuid REFERENCES classes(id) ON DELETE CASCADE
assigned_at     timestamptz DEFAULT now()
assigned_by     uuid REFERENCES profiles(id)
UNIQUE(challenge_id, class_id)
```

**RLS Policies**:
- Users with `challenge:create` permission can assign challenges to their classes
- Users with `challenge:read` permission can see assignments for their classes

---

### challenge_submissions
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
challenge_id    uuid REFERENCES daily_challenges(id) ON DELETE CASCADE
user_id         uuid REFERENCES profiles(id) ON DELETE CASCADE
content         text NOT NULL
submitted_at    timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
UNIQUE(challenge_id, user_id)
```

**RLS Policies**:
- Users with `challenge:submit` permission can create/update their own submissions
- Users with `submission:read_own` permission can read their own submissions
- Users with `submission:read_after_post` permission can read others' submissions ONLY if they have submitted
- Users with `submission:read_all` permission can read all submissions for challenges in their classes
- Users with relationship links can read related users' submissions

---

### class_materials
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
class_id        uuid REFERENCES classes(id) ON DELETE CASCADE
uploaded_by     uuid REFERENCES profiles(id) NOT NULL
title           text NOT NULL
description     text
material_type   text CHECK (material_type IN ('homework', 'notes', 'recording', 'other'))
file_url        text NOT NULL  -- Supabase Storage URL
uploaded_at     timestamptz DEFAULT now()
```

**RLS Policies**:
- Users with `material:upload` permission can upload materials to their classes
- Users with `material:read` permission can read materials for their classes
- Users with `material:delete` permission can delete materials they uploaded

---

## Storage Buckets

### class-materials
- Store homework, notes, recordings
- RLS enabled
- Teachers can upload to their classes
- Students/parents can download from their classes

### avatars
- Store user profile pictures
- RLS enabled
- Users can upload their own avatar

---

## Indexes (for performance)
```sql
-- RBAC indexes
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_class ON user_roles(class_id);
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_class_members_class ON class_members(class_id);
CREATE INDEX idx_class_members_user ON class_members(user_id);

-- Core entity indexes
CREATE INDEX idx_classes_created_by ON classes(created_by);
CREATE INDEX idx_challenges_date ON daily_challenges(challenge_date);
CREATE INDEX idx_challenges_created_by ON daily_challenges(created_by);
CREATE INDEX idx_submissions_challenge ON challenge_submissions(challenge_id);
CREATE INDEX idx_submissions_user ON challenge_submissions(user_id);
CREATE INDEX idx_materials_class ON class_materials(class_id);
CREATE INDEX idx_relationships_user ON user_relationships(user_id);
CREATE INDEX idx_relationships_related ON user_relationships(related_user_id);
```

---

## Helper Functions for RLS

### Check if user has permission in class
```sql
CREATE OR REPLACE FUNCTION user_has_permission(
  p_user_id uuid,
  p_permission_name text,
  p_class_id uuid DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = p_user_id
      AND p.name = p_permission_name
      AND (ur.class_id = p_class_id OR ur.class_id IS NULL)
  )
  OR EXISTS (
    SELECT 1
    FROM class_members cm
    JOIN role_permissions rp ON cm.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE cm.user_id = p_user_id
      AND cm.class_id = p_class_id
      AND p.name = p_permission_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Check if user has submitted challenge
```sql
CREATE OR REPLACE FUNCTION user_has_submitted(
  p_user_id uuid,
  p_challenge_id uuid
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM challenge_submissions
    WHERE user_id = p_user_id
      AND challenge_id = p_challenge_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Notes for Implementation
- Enable RLS on ALL tables before adding policies
- Test policies thoroughly with different user roles
- Use helper functions for complex permission checks
- Seed initial permissions and roles on database setup
- Consider caching permission checks for performance
- Use Supabase's policy helper functions (auth.uid())
- Document any custom policies added later
