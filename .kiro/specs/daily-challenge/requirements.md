# Daily Challenge - Requirements

## Overview
The Daily Challenge is the core feature of Henry's Math Classroom. It creates engagement through a unique "post to see others" mechanic where students must submit their solution before they can see other students' submissions.

## User Stories

### US-1: As a teacher, I want to create daily challenges
**Acceptance Criteria:**
- Can create a challenge with title and description
- Can set the challenge date
- Can assign challenge to one or more classes
- Can edit/delete challenges I created
- Can see all submissions immediately (no restriction)

### US-2: As a student, I want to view today's challenge
**Acceptance Criteria:**
- See today's challenge for my classes
- Clear, readable challenge description
- Submit button is prominent
- Can see if I've already submitted

### US-3: As a student, I want to submit my solution
**Acceptance Criteria:**
- Can write and submit my solution
- Can edit my submission before viewing others
- Get confirmation when submitted
- Submission is saved immediately

### US-4: As a student, I want to see others' solutions (after posting)
**Acceptance Criteria:**
- **CANNOT see others until I submit**
- After submitting, see all other submissions
- See student names with submissions
- See submission timestamps
- Encouraging message when viewing others

### US-5: As a teacher, I want to see all submissions
**Acceptance Criteria:**
- Can see all submissions immediately (no restriction)
- See which students submitted
- See which students haven't submitted
- See submission times

## Core Feature: "Post to See Others"

This is the unique mechanic that drives engagement:

1. **Before Submission**: Student sees challenge but NO other submissions
2. **After Submission**: Student unlocks view of all other submissions
3. **Teacher View**: Always sees everything

## Technical Requirements

### TR-1: Challenge Creation (Teacher)
- Form with title, description, date
- Multi-select for classes
- Validation
- Success feedback

### TR-2: Challenge View (Student)
- Show today's challenge
- Check if user has submitted
- Conditional rendering based on submission status

### TR-3: Submission System
- Text area for solution
- Submit button
- Edit capability (before viewing others)
- Optimistic UI updates

### TR-4: Discussion View
- List all submissions
- Show student info
- Sort by time
- Responsive grid/list

### TR-5: Permissions
- Teachers can create/edit/delete challenges
- Students can only submit to assigned challenges
- RLS policies enforce access control

## Out of Scope (Future)
- Rich text editor
- Image uploads in submissions
- Comments on submissions
- Likes/reactions
- Challenge templates

## Success Metrics
- Students submit solutions
- Students view others' solutions after submitting
- Teachers create regular challenges
- High engagement rate

## Priority
**Critical** - This is the core value proposition

## Estimated Effort
- Challenge creation: 2 hours
- Challenge view: 2 hours
- Submission system: 3 hours
- Discussion view: 2 hours
- Testing: 1 hour
- **Total: ~10 hours**
