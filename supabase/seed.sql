-- Seed data for Henry's Math Classroom
-- Initial permissions and roles

-- ============================================
-- SEED PERMISSIONS
-- ============================================

INSERT INTO permissions (name, description, resource, action) VALUES
  -- Class permissions
  ('class:create', 'Create new classes', 'class', 'create'),
  ('class:read', 'View class details', 'class', 'read'),
  ('class:update', 'Edit class information', 'class', 'update'),
  ('class:delete', 'Delete classes', 'class', 'delete'),
  
  -- Challenge permissions
  ('challenge:create', 'Create daily challenges', 'challenge', 'create'),
  ('challenge:read', 'View challenges', 'challenge', 'read'),
  ('challenge:submit', 'Submit challenge responses', 'challenge', 'submit'),
  ('challenge:update', 'Edit challenges', 'challenge', 'update'),
  ('challenge:delete', 'Delete challenges', 'challenge', 'delete'),
  
  -- Material permissions
  ('material:upload', 'Upload class materials', 'material', 'upload'),
  ('material:read', 'View/download materials', 'material', 'read'),
  ('material:delete', 'Delete materials', 'material', 'delete'),
  
  -- Submission permissions
  ('submission:read_all', 'View all student submissions', 'submission', 'read_all'),
  ('submission:read_own', 'View own submissions', 'submission', 'read_own'),
  ('submission:read_after_post', 'View others submissions after posting own', 'submission', 'read_after_post'),
  
  -- Member permissions
  ('member:manage', 'Add/remove class members', 'member', 'manage');

-- ============================================
-- SEED ROLES
-- ============================================

INSERT INTO roles (name, description, is_system) VALUES
  ('teacher', 'Full control over their classes', true),
  ('student', 'Can participate and submit work', true),
  ('observer', 'Read-only access (for parents)', true);

-- ============================================
-- MAP PERMISSIONS TO ROLES
-- ============================================

-- Teacher role permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'teacher'),
  id
FROM permissions
WHERE name IN (
  'class:create',
  'class:read',
  'class:update',
  'class:delete',
  'challenge:create',
  'challenge:read',
  'challenge:update',
  'challenge:delete',
  'material:upload',
  'material:read',
  'material:delete',
  'submission:read_all',
  'member:manage'
);

-- Student role permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'student'),
  id
FROM permissions
WHERE name IN (
  'class:read',
  'challenge:read',
  'challenge:submit',
  'material:read',
  'submission:read_own',
  'submission:read_after_post'
);

-- Observer role permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'observer'),
  id
FROM permissions
WHERE name IN (
  'class:read',
  'challenge:read',
  'material:read',
  'submission:read_own'
);
