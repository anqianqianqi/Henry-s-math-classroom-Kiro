# Testing Daily Challenge Feature

## Setup Steps

### 1. Create a Class First
Before running the mock data, you need at least one class:

1. Login as teacher: `anqiluo@amazon.com`
2. Go to http://localhost:3000/classes/new
3. Create a class (e.g., "Math 101")

### 2. Run Mock Data SQL
After creating a class, run the mock data:

1. Go to Supabase SQL Editor
2. Copy and paste `supabase/mock-challenge-data.sql`
3. Run it

This will create:
- 5 mock students (Sarah, Mike, Emma, Alex, Lisa)
- 3 challenges (yesterday, today, tomorrow)
- 4 submissions for today's challenge
- 3 submissions for yesterday's challenge
- Assign all challenges to your classes
- Add mock students to your classes

## Testing the "Post to See Others" Feature

### As Teacher (anqiluo@amazon.com)

1. Go to http://localhost:3000/dashboard
2. Click "New Challenge" button
3. You should see the challenge creation form
4. Go to http://localhost:3000/challenges
5. You should see today's challenge
6. Click on it - you'll see ALL submissions immediately (no lock)

### As Student (Create Test Account)

To test the student experience, create a second test account:

#### Option A: Via Supabase Dashboard
1. Go to Authentication → Users → "Add User"
2. Email: `student@test.com`
3. Password: `password123`
4. Check "Auto Confirm User"
5. Click "Create User"

#### Option B: Via Signup Page
1. Go to http://localhost:3000/signup
2. Sign up with student@test.com

#### Add Student to Class
After creating the student account, add them to your class:

```sql
-- Get the student's user ID
SELECT id FROM auth.users WHERE email = 'student@test.com';

-- Add to class (replace CLASS_ID with your class ID)
INSERT INTO class_members (class_id, user_id, role_id, joined_at)
VALUES (
  'YOUR_CLASS_ID',
  (SELECT id FROM auth.users WHERE email = 'student@test.com'),
  (SELECT id FROM roles WHERE name = 'student'),
  NOW()
);
```

Or get your class ID:
```sql
SELECT id, name FROM classes WHERE created_by = (SELECT id FROM auth.users WHERE email = 'anqiluo@amazon.com');
```

### Test the Lock/Unlock Flow

1. Login as student@test.com
2. Go to http://localhost:3000/challenges
3. Click on today's challenge
4. You should see:
   - ✅ Challenge description
   - ✅ Text area to write solution
   - ✅ Submit button
   - 🔒 LOCKED section showing "Submit your solution to see what others wrote"
   - ✅ Message showing "4 students have submitted"

5. Write a solution and click "Submit Solution"
6. You should see:
   - 🎉 Celebration banner appears
   - ✅ Your solution shown with "Edit" button
   - 🔓 UNLOCKED section showing all 4 other submissions
   - ✅ Each submission shows student name and time

7. Click "Edit" to modify your solution
8. Update and submit again

## Expected Behavior

### Before Submission (Student View)
- Can see challenge description
- Can write solution
- CANNOT see other submissions
- See count of how many submitted (creates FOMO)
- Big lock emoji 🔒

### After Submission (Student View)
- Celebration banner 🎉
- Your solution highlighted with green border
- Can edit your solution
- Can see ALL other submissions
- Each submission shows name and time

### Teacher View
- Always sees everything
- No lock - immediate access to all submissions
- Can create new challenges
- Can see submission stats

## Troubleshooting

### "No challenges" message
- Make sure you created a class first
- Make sure you ran the mock data SQL
- Check that challenges were assigned to your class:
  ```sql
  SELECT c.title, cl.name as class_name
  FROM daily_challenges c
  JOIN challenge_assignments ca ON c.id = ca.challenge_id
  JOIN classes cl ON ca.class_id = cl.id;
  ```

### Can't see other submissions after submitting
- Check browser console for errors
- Verify your submission was saved:
  ```sql
  SELECT * FROM challenge_submissions 
  WHERE user_id = (SELECT id FROM auth.users WHERE email = 'student@test.com');
  ```

### Mock students not showing
- Verify mock data was inserted:
  ```sql
  SELECT full_name FROM profiles WHERE email LIKE '%@student.com';
  ```

## Features to Test

- ✅ Create challenge (teacher)
- ✅ View challenges list
- ✅ View individual challenge
- ✅ Submit solution (student)
- ✅ Lock/unlock mechanic
- ✅ Edit submission
- ✅ View other submissions
- ✅ Time formatting ("5 minutes ago")
- ✅ Celebration animation
- ✅ Empty states
- ✅ Mobile responsive design

## Next Steps

After testing, you can:
1. Create more challenges via the UI
2. Invite real students
3. Add more classes
4. Monitor engagement

Enjoy testing! 🎉
