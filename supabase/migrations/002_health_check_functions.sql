-- ============================================
-- Health Check & Maintenance Functions
-- ============================================

-- RLS health check
CREATE OR REPLACE FUNCTION check_rls_health()
RETURNS TABLE(
  table_name TEXT,
  rls_enabled BOOLEAN,
  policy_count BIGINT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.tablename::TEXT,
    t.rowsecurity,
    COALESCE(p.cnt, 0),
    CASE
      WHEN NOT t.rowsecurity THEN '🚨 RLS DISABLED'
      WHEN COALESCE(p.cnt, 0) = 0 THEN '⚠️ NO POLICIES'
      ELSE '✅ OK'
    END
  FROM pg_tables t
  LEFT JOIN (
    SELECT pol.tablename, COUNT(*) as cnt
    FROM pg_policies pol WHERE pol.schemaname = 'public'
    GROUP BY pol.tablename
  ) p ON t.tablename = p.tablename
  WHERE t.schemaname = 'public'
  ORDER BY t.rowsecurity ASC, t.tablename;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notification cleanup (delete read notifications older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM notifications
  WHERE (is_read = TRUE AND created_at < NOW() - INTERVAL '90 days')
     OR (is_read = FALSE AND created_at < NOW() - INTERVAL '365 days');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration tracking table
CREATE TABLE IF NOT EXISTS _migrations (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE _migrations ENABLE ROW LEVEL SECURITY;
-- No policies = only service_role can access

-- Schedule cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-notifications', '0 3 * * *', 'SELECT cleanup_old_notifications()');
