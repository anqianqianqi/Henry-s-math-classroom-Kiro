# Schedule UI Guide - Visual Reference

## New Class Creation Form

### Schedule Section

```
┌─────────────────────────────────────────────────────────┐
│ 📅 Class Schedule ✅                                    │
│                                                         │
│ Add one or more meeting times for your class           │
│                                                         │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Date                    Time                    │   │
│ │ [2026-03-15      ▼]    [09:00        ▼]        │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Date                    Time                🗑️  │   │
│ │ [2026-03-17      ▼]    [09:00        ▼]        │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Date                    Time                🗑️  │   │
│ │ [2026-03-19      ▼]    [09:00        ▼]        │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ [➕ Add Another Meeting Time]                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Features
- Each row has date picker + time picker
- First row cannot be removed (always at least one)
- Additional rows have 🗑️ delete button
- Click "➕ Add Another Meeting Time" to add more
- Validation: At least one complete date+time required

---

## Class Detail View

### Header Display

```
┌─────────────────────────────────────────────────────────┐
│ Algebra 1 - Spring 2026                    [Edit] [Delete] │
│                                                         │
│ 📅 Monday, March 15, 2026 at 09:00                     │
│ 📅 Wednesday, March 17, 2026 at 09:00                  │
│ 📅 Friday, March 19, 2026 at 09:00                     │
└─────────────────────────────────────────────────────────┘
```

### Class Information Card

```
┌─────────────────────────────────────────────────────────┐
│ Class Information                                       │
├─────────────────────────────────────────────────────────┤
│ Description                                             │
│ Learn fundamental algebra concepts...                   │
│                                                         │
│ Meeting Times                                           │
│ 📅 Monday, March 15, 2026 • 09:00                      │
│ 📅 Wednesday, March 17, 2026 • 09:00                   │
│ 📅 Friday, March 19, 2026 • 09:00                      │
│                                                         │
│ Start Date                                              │
│ 3/1/2026                                                │
│                                                         │
│ End Date                                                │
│ 5/31/2026                                               │
└─────────────────────────────────────────────────────────┘
```

---

## Mobile View

### Schedule Input (Stacked)

```
┌───────────────────────────┐
│ 📅 Class Schedule ✅      │
│                           │
│ Date                      │
│ [2026-03-15        ▼]    │
│                           │
│ Time                      │
│ [09:00             ▼]    │
│                           │
│ ─────────────────────────│
│                           │
│ Date                  🗑️ │
│ [2026-03-17        ▼]    │
│                           │
│ Time                      │
│ [09:00             ▼]    │
│                           │
│ ─────────────────────────│
│                           │
│ [➕ Add Another]          │
└───────────────────────────┘
```

---

## Example Scenarios

### Scenario 1: Regular Weekly Class

**Input**:
- Monday 3/15 at 10:00
- Wednesday 3/17 at 10:00
- Friday 3/19 at 10:00
- Monday 3/22 at 10:00
- Wednesday 3/24 at 10:00

**Display**:
```
📅 Monday, March 15, 2026 • 10:00
📅 Wednesday, March 17, 2026 • 10:00
📅 Friday, March 19, 2026 • 10:00
📅 Monday, March 22, 2026 • 10:00
📅 Wednesday, March 24, 2026 • 10:00
```

### Scenario 2: Irregular Schedule

**Input**:
- Tuesday 3/2 at 9:00
- Thursday 3/5 at 14:00
- Monday 3/10 at 10:30

**Display**:
```
📅 Tuesday, March 2, 2026 • 09:00
📅 Thursday, March 5, 2026 • 14:00
📅 Monday, March 10, 2026 • 10:30
```

### Scenario 3: Single Workshop

**Input**:
- Saturday 3/15 at 13:00

**Display**:
```
📅 Saturday, March 15, 2026 • 13:00
```

---

## User Interactions

### Adding a Meeting Time

1. Click "➕ Add Another Meeting Time"
2. New row appears with empty date/time
3. Fill in date and time
4. Repeat as needed

### Removing a Meeting Time

1. Click 🗑️ button on the row
2. Row disappears immediately
3. Cannot remove if only one row left

### Editing a Meeting Time

1. Click on date picker → Select new date
2. Click on time picker → Select new time
3. Changes are immediate (no save button per row)

---

## Validation States

### Valid (Green Checkmark)
```
📅 Class Schedule ✅
```
- At least one complete date+time pair exists

### Invalid (No Checkmark)
```
📅 Class Schedule
💡 Add at least one meeting time
```
- All slots are empty
- Or only partial data (date without time, or time without date)

---

## Responsive Breakpoints

### Desktop (> 768px)
- Date and time side by side
- Delete button on right
- Full width form

### Tablet (768px - 1024px)
- Date and time side by side
- Slightly narrower
- Comfortable spacing

### Mobile (< 768px)
- Date and time stack vertically
- Delete button below time
- Full width inputs

---

## Accessibility

- ✅ Native date/time pickers (browser default)
- ✅ Keyboard navigation supported
- ✅ Screen reader friendly labels
- ✅ Clear button purposes (aria-label)
- ✅ Focus indicators on inputs

---

## Color Scheme (Duolingo Style)

- Primary: #22c55e (green)
- Border: #e5e7eb (gray-200)
- Focus: #22c55e with ring
- Hover: #f3f4f6 (gray-50)
- Delete: #ef4444 (red-500)

---

## Tips for Users

### For Teachers

1. **Add all meeting dates upfront** - Easier than adding later
2. **Use consistent times** - Students appreciate routine
3. **Double-check dates** - Especially for holidays
4. **Can edit anytime** - Not locked after creation

### For Students

1. **Check meeting times regularly** - Teacher may update
2. **Add to personal calendar** - Don't rely on memory
3. **Note the timezone** - Times shown in local time

---

## Common Questions

**Q: Can I add more than 10 meetings?**
A: Yes! No limit. Add as many as needed.

**Q: What if I don't know all dates yet?**
A: Add what you know, edit later to add more.

**Q: Can I have different times for different days?**
A: Yes! Each meeting can have its own time.

**Q: What timezone are times in?**
A: Times are stored as entered. No timezone conversion.

**Q: Can I copy a schedule from another class?**
A: Not yet, but you can manually enter the same times.

---

## Future UI Improvements

### Planned
- [ ] Recurring meeting generator
- [ ] Copy schedule from another class
- [ ] Bulk edit times
- [ ] Calendar view picker
- [ ] Duration field (end time)

### Requested
- [ ] Location/room field
- [ ] Meeting notes
- [ ] Zoom link per meeting
- [ ] Color coding by type

---

**Ready to use!** 🎉

Teachers can now create flexible class schedules with multiple specific meeting times.

