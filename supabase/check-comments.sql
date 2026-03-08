-- Check all comments in the database
SELECT 
  sc.id,
  sc.content,
  sc.created_at,
  p.full_name as commenter_name,
  cs.user_id as submission_owner_id,
  owner.full_name as submission_owner_name
FROM submission_comments sc
JOIN profiles p ON sc.user_id = p.id
JOIN challenge_submissions cs ON sc.submission_id = cs.id
JOIN profiles owner ON cs.user_id = owner.id
ORDER BY sc.created_at DESC
LIMIT 20;
