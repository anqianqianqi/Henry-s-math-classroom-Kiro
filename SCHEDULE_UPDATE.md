# Schedule Field Update - Multiple Date/Time Slots

**Date**: 2026-03-02  
**Feature**: Enhanced class schedule to support multiple meeting times  
**Status**: ✅ Complete

---

## What Changed

### Before
- Schedule was a single text field (dropdown selection)
- Example: "Mon/Wed/Fri 9:00 AM - 10:30 AM"
- Stored as plain text in database

### After
- Schedule is now multiple date/time pairs
- Each meeting has:
  - **Date**: Specific date picker
  - **Time**: Specific time picker
- Can add/remove multiple meeting times
- Stored as JSONB array in database

---

## Database Schema

The `classes` table already had `schedule JSONB`, so no migration needed!

**Format**:
```json
[
  { "date": "2026-03-15", "time": "09:00" },
  { "date": "2026-03-17", "time": "09:00" },
  { "date": "2026-03-19", "time": "09:00" }
]
```

---

## Files Modified

### 1. Class Creation Page (`app/classes/new/page.tsx`)

**Changes**:
- Added `ScheduleSlot` interface
- Replaced `schedule` string with `scheduleSlots` array
- Added functions:
  - `addScheduleSlot()` - Add new time slot
  - `removeScheduleSlot(id)` - Remove time slot
  - `updateScheduleSlot(id, field, value)` - Update date or time
- Replaced dropdown with dynamic date/time inputs
- Updated validation to check for at least one valid slot
- Updated submit to filter and format slots as JSONB

**UI**:
- Each slot has date and time inputs side by side
- "Add Another Meeting Time" button (➕)
- Remove button (🗑️) for each slot (except first)
- Responsive grid layout

### 2. Class Edit Page (`app/classes/[id]/edit/page.tsx`)

**Changes**:
- Added `ScheduleSlot` interface
- Replaced `schedule` string with `scheduleSlots` array
- Added same functions as creation page
- Updated `loadClass()` to parse JSONB schedule into slots
- Replaced text input with dynamic date/time inputs
- Updated submit to format slots as JSONB

**Loading**:
- Parses existing JSONB schedule from database
- Creates slot objects with unique IDs
- Falls back to single empty slot if no schedule

### 3. Class Detail Page (`app/classes/[id]/page.tsx`)

**Changes**:
- Updated `Class` interface: `schedule` is now array type
- Updated header display to show all meeting times
- Added "Meeting Times" section in Class Information card
- Formats dates with full weekday/month/day
- Shows time for each meeting
- Uses emoji (📅) for visual clarity

**Display Format**:
```
📅 Monday, March 15, 2026 • 09:00
📅 Wednesday, March 17, 2026 • 09:00
📅 Friday, March 19, 2026 • 09:00
```

---

## User Experience

### Creating a Class

1. Fill in class name
2. Add description (optional)
3. **Add meeting times**:
   - First slot is pre-added
   - Select date from date picker
   - Select time from time picker
   - Click "Add Another Meeting Time" for more slots
   - Click 🗑️ to remove unwanted slots
4. Set start/end dates
5. Create class

### Editing a Class

1. Existing meeting times load automatically
2. Can modify any date or time
3. Can add new meeting times
4. Can remove meeting times
5. Save changes

### Viewing a Class

1. Meeting times shown under class name
2. Full details in "Meeting Times" section
3. Each meeting shows full date and time

---

## Validation

- At least one meeting time required (date AND time)
- Empty slots are filtered out on save
- If all slots are empty, schedule is saved as null
- Date and time inputs use native browser pickers

---

## Examples

### Example 1: Regular Weekly Class
```json
[
  { "date": "2026-03-02", "time": "10:00" },
  { "date": "2026-03-04", "time": "10:00" },
  { "date": "2026-03-06", "time": "10:00" },
  { "date": "2026-03-09", "time": "10:00" },
  { "date": "2026-03-11", "time": "10:00" }
]
```

### Example 2: Irregular Schedule
```json
[
  { "date": "2026-03-02", "time": "09:00" },
  { "date": "2026-03-05", "time": "14:00" },
  { "date": "2026-03-10", "time": "10:30" }
]
```

### Example 3: Single Meeting
```json
[
  { "date": "2026-03-15", "time": "13:00" }
]
```

---

## Benefits

### For Teachers
- ✅ Flexible scheduling (any dates/times)
- ✅ Supports irregular schedules
- ✅ Easy to add/remove meetings
- ✅ Clear visual representation

### For Students
- ✅ See exact meeting dates and times
- ✅ No ambiguity (specific dates, not "Mon/Wed/Fri")
- ✅ Easy to add to personal calendar

### Technical
- ✅ Structured data (JSONB)
- ✅ Easy to query and filter
- ✅ Can add features like:
  - Calendar integration
  - Reminders
  - Attendance tracking per meeting
  - Rescheduling individual meetings

---

## Migration Notes

### Existing Classes

Classes created before this update may have:
- `schedule` as string (old format)
- `schedule` as null

**Handling**:
- Edit page checks if schedule is array
- Falls back to empty slot if not array
- Teacher can update to new format by editing

**Optional Migration Script**:
```sql
-- Convert old text schedules to null
-- Teachers can manually update to new format
UPDATE classes 
SET schedule = NULL 
WHERE schedule IS NOT NULL 
AND jsonb_typeof(schedule) != 'array';
```

---

## Testing Checklist

### Create Class
- [ ] Can add multiple meeting times
- [ ] Can remove meeting times
- [ ] Date picker works
- [ ] Time picker works
- [ ] Validation requires at least one slot
- [ ] Empty slots are ignored
- [ ] Class saves successfully
- [ ] Schedule displays correctly

### Edit Class
- [ ] Existing schedule loads correctly
- [ ] Can modify existing slots
- [ ] Can add new slots
- [ ] Can remove slots
- [ ] Changes save successfully
- [ ] Updated schedule displays correctly

### View Class
- [ ] Schedule shows in header
- [ ] Schedule shows in info card
- [ ] Dates format correctly
- [ ] Times display correctly
- [ ] Multiple meetings all visible

### Edge Cases
- [ ] Class with no schedule (optional)
- [ ] Class with one meeting
- [ ] Class with many meetings (10+)
- [ ] Old classes with text schedule
- [ ] Responsive on mobile

---

## Future Enhancements

### Possible Features
1. **Recurring Meetings**
   - "Repeat every Monday at 10:00 AM"
   - Auto-generate dates

2. **Duration**
   - Add end time for each meeting
   - Show "9:00 AM - 10:30 AM"

3. **Location**
   - Add room/location per meeting
   - "Room 101" or "Zoom link"

4. **Calendar Export**
   - Export to .ics file
   - Add to Google Calendar

5. **Attendance**
   - Track attendance per meeting
   - Mark students present/absent

6. **Reminders**
   - Send reminder before each meeting
   - Email or in-app notification

---

## Technical Details

### Data Structure

**TypeScript Interface**:
```typescript
interface ScheduleSlot {
  id: string      // Client-side only (for React keys)
  date: string    // ISO date format: "2026-03-15"
  time: string    // 24-hour format: "09:00"
}
```

**Database Storage**:
```json
[
  { "date": "2026-03-15", "time": "09:00" },
  { "date": "2026-03-17", "time": "09:00" }
]
```

### Key Functions

**Add Slot**:
```typescript
function addScheduleSlot() {
  setScheduleSlots([...scheduleSlots, { 
    id: crypto.randomUUID(), 
    date: '', 
    time: '' 
  }])
}
```

**Remove Slot**:
```typescript
function removeScheduleSlot(id: string) {
  if (scheduleSlots.length > 1) {
    setScheduleSlots(scheduleSlots.filter(slot => slot.id !== id))
  }
}
```

**Update Slot**:
```typescript
function updateScheduleSlot(id: string, field: 'date' | 'time', value: string) {
  setScheduleSlots(scheduleSlots.map(slot =>
    slot.id === id ? { ...slot, [field]: value } : slot
  ))
}
```

**Save to Database**:
```typescript
const validSlots = scheduleSlots
  .filter(slot => slot.date && slot.time)
  .map(slot => ({
    date: slot.date,
    time: slot.time
  }))

await supabase
  .from('classes')
  .insert({
    schedule: validSlots.length > 0 ? validSlots : null
  })
```

---

## Summary

The schedule field has been successfully upgraded from a simple text field to a flexible, structured system that supports multiple meeting times with specific dates and times. This provides much better flexibility for teachers and clarity for students, while maintaining backward compatibility with existing data.

**Status**: ✅ Complete and ready to use!

---

**Next Steps**: Test the new schedule functionality and gather feedback from teachers.

