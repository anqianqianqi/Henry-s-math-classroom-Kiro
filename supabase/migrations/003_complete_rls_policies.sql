-- ============================================
-- COMPLETE RLS POLICIES FOR PRODUCTION
-- Run this entire block in Supabase SQL Editor
-- ============================================

-- Reference tables
DROP POLICY IF EXISTS "Anyone can read permissions" ON permissions;
CREATE POLICY "Anyone can read permissions" ON permissions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can read roles" ON roles;
CREATE POLICY "Anyone can read roles" ON roles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can read role permissions" ON role_permissions;
CREATE POLICY "Anyone can read role permissions" ON role_permissions FOR SELECT USING (true);

-- Profiles
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Authenticated can read profiles" ON profiles;
CREATE POLICY "Authenticated can read profiles" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can read class member profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read teacher profiles" ON profiles;

-- User roles
DROP POLICY IF EXISTS "Users can read own roles" ON user_roles;
CREATE POLICY "Users can read own roles" ON user_roles FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Teachers can read all roles" ON user_roles;
CREATE POLICY "Teachers can read all roles" ON user_roles FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name IN ('teacher','administrator') AND ur.class_id IS NULL)
);
DROP POLICY IF EXISTS "Teachers can manage roles" ON user_roles;
CREATE POLICY "Teachers can manage roles" ON user_roles FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name IN ('teacher','administrator') AND ur.class_id IS NULL)
);

-- Classes
DROP POLICY IF EXISTS "Authenticated can read classes" ON classes;
CREATE POLICY "Authenticated can read classes" ON classes FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Users can read their classes" ON classes;
DROP POLICY IF EXISTS "Teachers can create classes" ON classes;
CREATE POLICY "Teachers can create classes" ON classes FOR INSERT WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "Users with permission can create classes" ON classes;
DROP POLICY IF EXISTS "Owners can update classes" ON classes;
CREATE POLICY "Owners can update classes" ON classes FOR UPDATE USING (auth.uid() = created_by);
DROP POLICY IF EXISTS "Users can update their classes" ON classes;
DROP POLICY IF EXISTS "Owners can delete classes" ON classes;
CREATE POLICY "Owners can delete classes" ON classes FOR DELETE USING (auth.uid() = created_by);
DROP POLICY IF EXISTS "Users can delete their classes" ON classes;

-- Class members
DROP POLICY IF EXISTS "Authenticated can read members" ON class_members;
CREATE POLICY "Authenticated can read members" ON class_members FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Users can read own memberships" ON class_members;
DROP POLICY IF EXISTS "Users can read class members" ON class_members;
DROP POLICY IF EXISTS "Teachers can manage members" ON class_members;
CREATE POLICY "Teachers can manage members" ON class_members FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name IN ('teacher','administrator') AND ur.class_id IS NULL)
);

-- Daily challenges
DROP POLICY IF EXISTS "Authenticated can read challenges" ON daily_challenges;
CREATE POLICY "Authenticated can read challenges" ON daily_challenges FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Users can read assigned challenges" ON daily_challenges;
DROP POLICY IF EXISTS "Users can create challenges" ON daily_challenges;
DROP POLICY IF EXISTS "Teachers can manage challenges" ON daily_challenges;
CREATE POLICY "Teachers can manage challenges" ON daily_challenges FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name IN ('teacher','administrator') AND ur.class_id IS NULL)
);

-- Challenge assignments
DROP POLICY IF EXISTS "Authenticated can read assignments" ON challenge_assignments;
CREATE POLICY "Authenticated can read assignments" ON challenge_assignments FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Teachers can manage assignments" ON challenge_assignments;
CREATE POLICY "Teachers can manage assignments" ON challenge_assignments FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name IN ('teacher','administrator') AND ur.class_id IS NULL)
);

-- Challenge submissions
DROP POLICY IF EXISTS "Users can read own submissions" ON challenge_submissions;
CREATE POLICY "Authenticated can read submissions" ON challenge_submissions FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Users can read submissions after posting" ON challenge_submissions;
DROP POLICY IF EXISTS "Users can create own submissions" ON challenge_submissions;
DROP POLICY IF EXISTS "Users can create submissions" ON challenge_submissions;
CREATE POLICY "Users can create submissions" ON challenge_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own submissions" ON challenge_submissions;
CREATE POLICY "Users can update own submissions" ON challenge_submissions FOR UPDATE USING (auth.uid() = user_id);

-- Notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT WITH CHECK (true);

-- Join requests
DROP POLICY IF EXISTS "Users can create join requests" ON class_join_requests;
CREATE POLICY "Users can create join requests" ON class_join_requests FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can read own requests" ON class_join_requests;
DROP POLICY IF EXISTS "Users can view own join requests" ON class_join_requests;
CREATE POLICY "Users can read own requests" ON class_join_requests FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Teachers can read requests" ON class_join_requests;
DROP POLICY IF EXISTS "Teachers can view class join requests" ON class_join_requests;
CREATE POLICY "Teachers can read requests" ON class_join_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM classes WHERE classes.id = class_join_requests.class_id AND classes.created_by = auth.uid())
);
DROP POLICY IF EXISTS "Admins can view all join requests" ON class_join_requests;
DROP POLICY IF EXISTS "Teachers can update requests" ON class_join_requests;
DROP POLICY IF EXISTS "Teachers can update class join requests" ON class_join_requests;
CREATE POLICY "Teachers can update requests" ON class_join_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM classes WHERE classes.id = class_join_requests.class_id AND classes.created_by = auth.uid())
);
DROP POLICY IF EXISTS "Admins can update all join requests" ON class_join_requests;
DROP POLICY IF EXISTS "Users can delete own requests" ON class_join_requests;
CREATE POLICY "Users can delete own requests" ON class_join_requests FOR DELETE USING (user_id = auth.uid());

-- Class occurrences
DROP POLICY IF EXISTS "Authenticated can read occurrences" ON class_occurrences;
CREATE POLICY "Authenticated can read occurrences" ON class_occurrences FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Teachers can manage occurrences" ON class_occurrences;
CREATE POLICY "Teachers can manage occurrences" ON class_occurrences FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name IN ('teacher','administrator') AND ur.class_id IS NULL)
);

-- Session materials
DROP POLICY IF EXISTS "Authenticated can read materials" ON session_materials;
CREATE POLICY "Authenticated can read materials" ON session_materials FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Teachers can manage materials" ON session_materials;
CREATE POLICY "Teachers can manage materials" ON session_materials FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name IN ('teacher','administrator') AND ur.class_id IS NULL)
);

-- Homework assignments
DROP POLICY IF EXISTS "Authenticated can read homework" ON homework_assignments;
CREATE POLICY "Authenticated can read homework" ON homework_assignments FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Teachers can manage homework" ON homework_assignments;
CREATE POLICY "Teachers can manage homework" ON homework_assignments FOR ALL USING (
  EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name IN ('teacher','administrator') AND ur.class_id IS NULL)
);

-- Notification preferences
DROP POLICY IF EXISTS "Users can read own prefs" ON notification_preferences;
CREATE POLICY "Users can read own prefs" ON notification_preferences FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can manage own prefs" ON notification_preferences;
CREATE POLICY "Users can manage own prefs" ON notification_preferences FOR ALL USING (user_id = auth.uid());
