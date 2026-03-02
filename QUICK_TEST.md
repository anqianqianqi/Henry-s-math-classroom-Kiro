# Quick Test - Edit & Delete Features

**Time**: 5 minutes  
**Purpose**: Smoke test to verify basic functionality

---

## Setup (30 seconds)

```bash
# Start server
docker run --rm -d -v $(pwd):/app -w /app --env-file .env.local -p 3000:3000 --name henry-math-dev node:18 npm run dev

# Open browser
http://localhost:3000
```

---

## Test Edit (2 minutes)

1. **Login**: `anqiluo@amazon.com`
2. **Navigate**: Dashboard → Challenges → Click any challenge
3. **Edit**: Click "Edit" button (should see ✏️ Edit)
4. **Modify**: Change title to "Test Edit [timestamp]"
5. **Save**: Click "Save Changes"
6. **Verify**: Title updated on detail page ✅

**Expected**: Form loads, saves, redirects, shows updated title

---

## Test Delete (2 minutes)

1. **Create**: Go to Challenges → New Challenge
   - Title: "Test Delete"
   - Description: "This will be deleted"
   - Date: Today
   - Select any class
   - Create

2. **Delete**: Click "Delete" button (should see 🗑️ Delete)
3. **Confirm**: Read modal, click "Delete Challenge"
4. **Verify**: Redirects to list, challenge is gone ✅

**Expected**: Modal appears, deletes, redirects, challenge removed

---

## Check Console (30 seconds)

1. Open DevTools (F12)
2. Check Console tab
3. Look for errors

**Expected**: No red errors ❌

---

## Quick Checks

- [ ] Edit button visible (teacher only)
- [ ] Edit form loads with data
- [ ] Can save changes
- [ ] Changes appear on page
- [ ] Delete button visible (teacher only)
- [ ] Delete modal appears
- [ ] Can delete challenge
- [ ] Challenge removed from list
- [ ] No console errors

---

## If Something Fails

1. Check browser console for errors
2. Check Docker logs: `docker logs henry-math-dev`
3. Verify you're logged in as teacher
4. Try refreshing the page
5. Check `TESTING_EDIT_DELETE.md` for detailed tests

---

## Pass/Fail

**PASS** ✅ if:
- Edit works
- Delete works
- No console errors

**FAIL** ❌ if:
- Buttons don't appear
- Forms don't load
- Save/delete doesn't work
- Console shows errors

---

**Quick test complete!** 🎉

For comprehensive testing, see `TESTING_EDIT_DELETE.md`

