-- Fix Profile Creation on Signup
-- This trigger automatically creates a profile when a user signs up

-- ============================================
-- Create trigger function
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile for new user
  INSERT INTO public.profiles (id, email, full_name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NOW()
  );
  
  -- Assign default student role
  INSERT INTO public.user_roles (user_id, role_id, class_id)
  VALUES (
    NEW.id,
    (SELECT id FROM public.roles WHERE name = 'student'),
    NULL
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Create trigger on auth.users
-- ============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_signup();

-- ============================================
-- Grant permissions
-- ============================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.user_roles TO authenticated;

-- ============================================
-- Success message
-- ============================================

SELECT '✅ Profile creation trigger installed!' as status;
SELECT 'New signups will now automatically create profiles and assign student role' as info;
