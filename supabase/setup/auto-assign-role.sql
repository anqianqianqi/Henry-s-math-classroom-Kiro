-- Automatically assign student role to new users
-- Run this in Supabase SQL Editor after schema.sql

-- Function to assign default student role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Assign student role by default
  INSERT INTO public.user_roles (user_id, role_id, class_id)
  VALUES (
    NEW.id,
    (SELECT id FROM public.roles WHERE name = 'student'),
    NULL  -- NULL means global role, not class-specific
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run after user profile is created
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.user_roles TO authenticated;
GRANT ALL ON public.profiles TO authenticated;

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically assigns student role to new users';
