-- Henry's Math Classroom Database Schema
-- RBAC (Role-Based Access Control) with RLS

-- ============================================
-- CLEANUP: DROP ALL EXISTING OBJECTS
-- ============================================

-- Drop functions first (they don't depend on tables)
DROP FUNCTION IF EXISTS user_has_permission(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS user_has_submitted(UUID, UUID);

-- Drop tables (CASCADE will automatically drop all policies)
DROP TABLE IF EXISTS class_materials CASCADE;
DROP TABLE IF EXISTS challenge_submissions CASCADE;
DROP TABLE IF EXISTS challenge_assignments CASCADE;
DROP TABLE IF EXISTS daily_challenges CASCADE;
DROP TABLE IF EXISTS user_relationships CASCADE;
DROP TABLE IF EXISTS class_members CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;

-- Note: Storage buckets must be deleted manually from Supabase dashboard
-- Go to Storage → Delete 'class-materials' and 'avatars' buckets if they exist

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- RBAC TABLES
-- ============================================

-- Permissions table (predefined system permissions)
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roles table (predefined system roles)
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role permissions mapping
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- ============================================
-- USER TABLES
-- ============================================

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  nickname TEXT,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CLASS TABLES
-- ============================================

-- Classes table
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID REFERENCES profiles(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  schedule JSONB,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User roles (assigns roles to users) - moved here after classes is created
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES profiles(id),
  UNIQUE(user_id, role_id, class_id)
);

-- Class members
CREATE TABLE class_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES profiles(id),
  UNIQUE(class_id, user_id, role_id)
);

-- User relationships (parent-student links)
CREATE TABLE user_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  related_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL CHECK (relationship IN ('parent', 'guardian', 'sibling')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, related_user_id, relationship)
);

-- ============================================
-- CHALLENGE TABLES
-- ============================================

-- Daily challenges
CREATE TABLE daily_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID REFERENCES profiles(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  challenge_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Challenge assignments to classes
CREATE TABLE challenge_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id UUID REFERENCES daily_challenges(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES profiles(id),
  UNIQUE(challenge_id, class_id)
);

-- Challenge submissions
CREATE TABLE challenge_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id UUID REFERENCES daily_challenges(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(challenge_id, user_id)
);

-- ============================================
-- MATERIAL TABLES
-- ============================================

-- Class materials
CREATE TABLE class_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES profiles(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  material_type TEXT CHECK (material_type IN ('homework', 'notes', 'recording', 'other')),
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

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

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if user has permission in class
CREATE OR REPLACE FUNCTION user_has_permission(
  p_user_id UUID,
  p_permission_name TEXT,
  p_class_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
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

-- Check if user has submitted challenge
CREATE OR REPLACE FUNCTION user_has_submitted(
  p_user_id UUID,
  p_challenge_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM challenge_submissions
    WHERE user_id = p_user_id
      AND challenge_id = p_challenge_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_materials ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Permissions: Everyone can read (needed for permission checks)
CREATE POLICY "Anyone can read permissions"
  ON permissions FOR SELECT
  USING (true);

-- Roles: Everyone can read (needed for permission checks)
CREATE POLICY "Anyone can read roles"
  ON roles FOR SELECT
  USING (true);

-- Role permissions: Everyone can read (needed for permission checks)
CREATE POLICY "Anyone can read role permissions"
  ON role_permissions FOR SELECT
  USING (true);

-- Profiles: Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Profiles: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Profiles: Users can read profiles of class members
CREATE POLICY "Users can read class member profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_members cm1
      JOIN class_members cm2 ON cm1.class_id = cm2.class_id
      WHERE cm1.user_id = auth.uid()
        AND cm2.user_id = profiles.id
    )
  );

-- User roles: Users can read their own role assignments
CREATE POLICY "Users can read own roles"
  ON user_roles FOR SELECT
  USING (user_id = auth.uid());

-- Classes: Users with class:create can create classes
CREATE POLICY "Users with permission can create classes"
  ON classes FOR INSERT
  WITH CHECK (user_has_permission(auth.uid(), 'class:create'));

-- Classes: Users can read classes they're members of
CREATE POLICY "Users can read their classes"
  ON classes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_members
      WHERE class_id = classes.id
        AND user_id = auth.uid()
    )
  );

-- Classes: Users with class:update can update their classes
CREATE POLICY "Users can update their classes"
  ON classes FOR UPDATE
  USING (
    user_has_permission(auth.uid(), 'class:update', id)
  );

-- Classes: Users with class:delete can delete their classes
CREATE POLICY "Users can delete their classes"
  ON classes FOR DELETE
  USING (
    user_has_permission(auth.uid(), 'class:delete', id)
  );

-- Class members: Users can read their own memberships
CREATE POLICY "Users can read own memberships"
  ON class_members FOR SELECT
  USING (user_id = auth.uid());

-- Class members: Users can read other members in their classes
CREATE POLICY "Users can read class members"
  ON class_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_members cm
      WHERE cm.class_id = class_members.class_id
        AND cm.user_id = auth.uid()
    )
  );

-- Daily challenges: Users with challenge:create can create challenges
CREATE POLICY "Users can create challenges"
  ON daily_challenges FOR INSERT
  WITH CHECK (user_has_permission(auth.uid(), 'challenge:create'));

-- Daily challenges: Users can read challenges assigned to their classes
CREATE POLICY "Users can read assigned challenges"
  ON daily_challenges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM challenge_assignments ca
      JOIN class_members cm ON ca.class_id = cm.class_id
      WHERE ca.challenge_id = daily_challenges.id
        AND cm.user_id = auth.uid()
    )
  );

-- Challenge submissions: Users can create their own submissions
CREATE POLICY "Users can create own submissions"
  ON challenge_submissions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND user_has_permission(auth.uid(), 'challenge:submit')
  );

-- Challenge submissions: Users can read their own submissions
CREATE POLICY "Users can read own submissions"
  ON challenge_submissions FOR SELECT
  USING (user_id = auth.uid());

-- Challenge submissions: Users can read others' submissions after posting
CREATE POLICY "Users can read submissions after posting"
  ON challenge_submissions FOR SELECT
  USING (
    user_has_submitted(auth.uid(), challenge_id)
    OR user_has_permission(auth.uid(), 'submission:read_all')
  );

-- Class materials: Users with material:upload can upload
CREATE POLICY "Users can upload materials"
  ON class_materials FOR INSERT
  WITH CHECK (
    user_has_permission(auth.uid(), 'material:upload', class_id)
  );

-- Class materials: Users can read materials for their classes
CREATE POLICY "Users can read class materials"
  ON class_materials FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_members
      WHERE class_id = class_materials.class_id
        AND user_id = auth.uid()
    )
  );
