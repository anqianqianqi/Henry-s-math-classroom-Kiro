# Teacher Challenge Management - Enhancement Plan

**Created**: 2026-03-01  
**Status**: Planning Phase  
**Priority**: High

---

## Current State

### What Works ✅
- Teachers can create challenges (`/challenges/new`)
- Teachers see their created challenges in list view
- Teachers see submission stats (count, completion rate)
- Teachers see expandable student list (who submitted, who hasn't)
- Teachers see all student submissions immediately
- Challenge assignment to multiple classes during creation

### What's Missing ❌
- No way to edit existing challenges
- No way to delete challenges
- No way to reassign challenges to different classes
- No bulk operations (duplicate, archive)
- No challenge templates or reuse
- Limited challenge list view (no stats preview)
- No filtering/sorting in challenge list
- No way to send reminders to students
- No export of submissions

---

## Proposed Enhancements

### Phase 1: Core Management (High Priority)

#### 1.1 Edit Challenge
**Location**: `/challenges/[id]/edit`

**Features**:
- Edit title, description, date
- Change class assignments (add/remove classes)
- Preview changes before saving
- Validation (can't change date to past if already has submissions)

**UI Components**:
- Reuse form from `/challenges/new`
- Add warning if challenge has submissions
- Show "Last edited" timestamp

**Database**:
- Add `updated_at` column to `daily_challenges`
- Add `updated_by` column (track who edited)

#### 1.2 Delete Challenge
**Location**: Challenge detail page (`/challenges/[id]`)

**Features**:
- Delete button (teacher view only)
- Confirmation modal with warning
- Show submission count before delete
- Cascade delete submissions and assignments (or soft delete)

**UI Components**:
- Danger button in header
- Modal with "Are you sure?" + submission count
- Option: "Delete challenge and all submissions" vs "Archive"

**Database**:
- Option A: Hard delete (CASCADE)
- Option B: Soft delete (add `is_deleted` flag)
- Recommendation: Soft delete to preserve data

#### 1.3 Enhanced Challenge List (Teacher View)
**Location**: `/challenges/page.tsx`

**Features**:
- Show stats preview on each card (submission count, completion %)
- Quick actions menu (Edit, Delete, Duplicate)
- Filter by: Date range, Class, Status (active/past/upcoming)
- Sort by: Date, Submission count, Completion rate
- Search by title

**UI Layout**:
```
┌─────────────────────────────────────────┐
│ 🎯 Daily Challenges        [+ Create]   │
├─────────────────────────────────────────┤
│ Filters: [All Classes ▼] [All Dates ▼] │
│ Sort: [Date ▼]          Search: [____]  │
├─────────────────────────────────────────┤
│ 🔥 TODAY                                │
│ ┌─────────────────────────────────────┐ │
│ │ Solve for x: Linear Equation    [⋮] │ │
│ │ Math 101                             │ │
│ │ 📊 5/10 submitted (50%)              │ │
│ │ [View Details]                       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 📚 UPCOMING                             │
│ ┌─────────────────────────────────────┐ │
│ │ Quadratic Equations             [⋮] │ │
│ │ Math 101, Math 102                   │ │
│ │ 📅 Tomorrow                          │ │
│ │ [Edit] [Delete]                      │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 📖 PAST                                 │
│ [Show 15 more...]                       │
└─────────────────────────────────────────┘
```

---

### Phase 2: Productivity Features (Medium Priority)

#### 2.1 Duplicate Challenge
**Location**: Challenge list or detail page

**Features**:
- One-click duplicate
- Auto-adjust date to next available day
- Copy title (add "Copy of...")
- Copy description
- Copy class assignments
- Don't copy submissions

**Flow**:
1. Click "Duplicate" button
2. Redirect to edit page with pre-filled data
3. User adjusts date/title
4. Save as new challenge

#### 2.2 Challenge Templates
**Location**: `/challenges/new` (add tab)

**Features**:
- Save challenge as template
- Browse template library
- Use template to create new challenge
- Templates are personal (per teacher)

**UI**:
```
┌─────────────────────────────────────┐
│ [New Challenge] [From Template]    │
├─────────────────────────────────────┤
│ My Templates:                       │
│ • Linear Equations (used 5x)        │
│ • Word Problems (used 3x)           │
│ • Geometry Basics (used 2x)         │
│                                     │
│ [+ Save current as template]        │
└─────────────────────────────────────┘
```

**Database**:
- New table: `challenge_templates`
- Columns: id, created_by, title, description, is_active

#### 2.3 Bulk Operations
**Location**: Challenge list page

**Features**:
- Select multiple challenges (checkbox)
- Bulk delete
- Bulk assign to class
- Bulk archive

**UI**:
- Checkbox on each card
- "Select all" option
- Action bar appears when items selected

---

### Phase 3: Communication & Analytics (Lower Priority)

#### 3.1 Student Reminders
**Location**: Challenge detail page (teacher view)

**Features**:
- "Send Reminder" button
- Shows list of students who haven't submitted
- Send in-app notification (future: email)
- Track reminder sent timestamp

**UI**:
- Button in stats dashboard
- Modal to confirm
- Success message

**Database**:
- New table: `challenge_reminders`
- Columns: id, challenge_id, sent_by, sent_at, recipient_ids

#### 3.2 Export Submissions
**Location**: Challenge detail page (teacher view)

**Features**:
- Export as CSV
- Export as PDF (formatted)
- Include: Student name, submission, timestamp
- Option to include/exclude student names (for blind grading)

**UI**:
- "Export" button with dropdown
- Options: CSV, PDF, Anonymous PDF

#### 3.3 Challenge Analytics Dashboard
**Location**: `/challenges/analytics` (new page)

**Features**:
- Overview of all challenges
- Average completion rate
- Most engaged classes
- Submission time patterns
- Challenge difficulty analysis (based on completion)

**UI**:
- Charts and graphs
- Date range selector
- Class filter

---

## Implementation Priority

### Must Have (Phase 1) - Implement First
1. ✅ Edit Challenge (1.1)
2. ✅ Delete Challenge (1.2)
3. ✅ Enhanced Challenge List (1.3)

**Estimated Time**: 4-6 hours
**Impact**: High - Core functionality gap

### Should Have (Phase 2) - Implement Second
4. Duplicate Challenge (2.1)
5. Challenge Templates (2.2)

**Estimated Time**: 3-4 hours
**Impact**: Medium - Productivity boost

### Nice to Have (Phase 3) - Implement Later
6. Student Reminders (3.1)
7. Export Submissions (3.2)
8. Analytics Dashboard (3.3)
9. Bulk Operations (2.3)

**Estimated Time**: 6-8 hours
**Impact**: Medium - Quality of life

---

## Technical Considerations

### Database Changes Needed

```sql
-- Add soft delete and tracking to daily_challenges
ALTER TABLE daily_challenges
ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN updated_at TIMESTAMPTZ,
ADD COLUMN updated_by UUID REFERENCES profiles(id);

-- Create challenge_templates table
CREATE TABLE challenge_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID REFERENCES profiles(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies for templates
CREATE POLICY "Users can read own templates"
  ON challenge_templates FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can create own templates"
  ON challenge_templates FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());
```

### UI Components to Create

1. **ConfirmModal** - Reusable confirmation dialog
2. **DropdownMenu** - Three-dot menu for actions
3. **FilterBar** - Filter and sort controls
4. **StatsCard** - Preview stats on challenge cards
5. **ExportButton** - Export dropdown with options

### Routes to Add

- `/challenges/[id]/edit` - Edit challenge page
- `/challenges/analytics` - Analytics dashboard (Phase 3)

---

## UI/UX Decisions to Review

### 1. Edit vs Delete Placement
**Option A**: Both in header (current detail page)
**Option B**: Edit in header, Delete in danger zone at bottom
**Option C**: Three-dot menu with all actions

**Recommendation**: Option A for visibility, but use danger styling for delete

### 2. Challenge List Layout
**Option A**: Card grid (current)
**Option B**: Table view with columns
**Option C**: Toggle between card/table

**Recommendation**: Option A (cards) but add stats preview

### 3. Delete Behavior
**Option A**: Hard delete (permanent)
**Option B**: Soft delete (archive, can restore)
**Option C**: Move to "Archived" section

**Recommendation**: Option B (soft delete) to preserve data

### 4. Duplicate Flow
**Option A**: Duplicate → Auto-save → Redirect to edit
**Option B**: Duplicate → Open edit form with data
**Option C**: Duplicate → Show in list as draft

**Recommendation**: Option B (edit form) for user control

### 5. Filter Persistence
**Option A**: Filters reset on page leave
**Option B**: Filters saved in URL params
**Option C**: Filters saved in localStorage

**Recommendation**: Option B (URL params) for shareability

---

## Questions for Review

1. **Soft delete vs hard delete**: Should we keep deleted challenges in database?
   - Pro soft: Data preservation, undo capability
   - Pro hard: Cleaner database, true deletion
   - **Recommendation**: Soft delete

2. **Edit restrictions**: Can teachers edit challenges that have submissions?
   - Option A: Yes, but show warning
   - Option B: No, must duplicate instead
   - Option C: Yes, but can't change date
   - **Recommendation**: Option A (allow with warning)

3. **Class reassignment**: When reassigning classes, what happens to existing submissions?
   - Option A: Keep all submissions (even from removed classes)
   - Option B: Delete submissions from removed classes
   - Option C: Show warning, let teacher decide
   - **Recommendation**: Option A (keep submissions)

4. **Challenge list default view**: What should teachers see first?
   - Option A: All challenges (current)
   - Option B: Today + upcoming only
   - Option C: Active challenges (today + future)
   - **Recommendation**: Option C (active challenges)

5. **Stats on list view**: How much detail?
   - Option A: Just submission count
   - Option B: Count + completion %
   - Option C: Count + % + class names
   - **Recommendation**: Option B (count + %)

---

## Next Steps

1. **Review this plan** with user
2. **Decide on priorities** (Phase 1 only? Phase 1+2?)
3. **Confirm UI/UX decisions** (5 questions above)
4. **Start implementation** with Phase 1.1 (Edit Challenge)

---

## Success Criteria

Phase 1 complete when:
- [ ] Teachers can edit existing challenges
- [ ] Teachers can delete challenges (with confirmation)
- [ ] Challenge list shows stats preview
- [ ] Challenge list has filters (class, date range)
- [ ] Challenge list has search
- [ ] All actions work without errors
- [ ] UI follows Duolingo style

---

**Ready for review!** 🎯
