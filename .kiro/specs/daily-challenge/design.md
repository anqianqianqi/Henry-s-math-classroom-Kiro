# Daily Challenge - Design Document

## UI/UX Design

### Student Flow: "Post to See Others" Experience

#### State 1: Before Submission (Locked State)

```
┌─────────────────────────────────────────────────┐
│ 📚 Today's Challenge                            │
│ Algebra Problem #42                             │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Challenge Description                           │
│                                                 │
│ Solve for x: 2x + 5 = 15                       │
│                                                 │
│ Show your work and explain your reasoning.      │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Your Solution                                   │
│ ┌─────────────────────────────────────────────┐ │
│ │ [Empty text area]                           │ │
│ │                                             │ │
│ │                                             │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [Submit Solution] ← Big, bright button         │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 🔒 Other Students' Solutions                    │
│                                                 │
│     Submit your solution to see what           │
│     other students wrote!                      │
│                                                 │
│     [Locked illustration/emoji]                │
└─────────────────────────────────────────────────┘
```

**Key Design Elements:**
- Clear locked state with 🔒 emoji
- Encouraging message
- Prominent submit button
- No peek at others' solutions

---

#### State 2: After Submission (Unlocked State)

```
┌─────────────────────────────────────────────────┐
│ 📚 Today's Challenge                            │
│ Algebra Problem #42                             │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ ✅ Your Solution (Submitted)                    │
│ ┌─────────────────────────────────────────────┐ │
│ │ x = 5                                       │ │
│ │ First, subtract 5 from both sides...        │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [Edit Solution]  Submitted 2 minutes ago       │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 🎉 Other Students' Solutions (12 submissions)   │
│                                                 │
│ ┌───────────────────────────────────────────┐   │
│ │ 👤 Sarah Chen                             │   │
│ │ x = 5. I subtracted 5 from both sides,   │   │
│ │ then divided by 2.                        │   │
│ │ 📅 5 minutes ago                          │   │
│ └───────────────────────────────────────────┘   │
│                                                 │
│ ┌───────────────────────────────────────────┐   │
│ │ 👤 Mike Johnson                           │   │
│ │ The answer is x = 5. Here's my work:      │   │
│ │ 2x + 5 = 15                               │   │
│ │ 2x = 10                                   │   │
│ │ x = 5                                     │   │
│ │ 📅 8 minutes ago                          │   │
│ └───────────────────────────────────────────┘   │
│                                                 │
│ ┌───────────────────────────────────────────┐   │
│ │ 👤 Emma Davis                             │   │
│ │ I got x = 5 by isolating the variable... │   │
│ │ 📅 12 minutes ago                         │   │
│ └───────────────────────────────────────────┘   │
│                                                 │
│ [Load More...]                                  │
└─────────────────────────────────────────────────┘
```

**Key Design Elements:**
- Celebration emoji 🎉 when unlocked
- Your solution shown at top (with edit option)
- Other solutions in cards below
- Student names with avatars/emojis
- Timestamps for each submission
- Clean, readable layout

---

### Detailed Component Design

#### 1. Challenge Card (Top Section)

```typescript
<Card className="mb-6">
  <Card.Header>
    <div className="flex items-center gap-3">
      <span className="text-3xl">📚</span>
      <div>
        <Card.Title>{challenge.title}</Card.Title>
        <p className="text-sm text-gray-500">
          {format(challenge.challenge_date, 'MMMM d, yyyy')}
        </p>
      </div>
    </div>
  </Card.Header>
  <Card.Body>
    <p className="text-gray-700 whitespace-pre-wrap">
      {challenge.description}
    </p>
  </Card.Body>
</Card>
```

**Styling:**
- Large emoji for visual interest
- Clear title and date
- Description with proper line breaks
- Rounded corners (Duolingo style)

---

#### 2. Submission Form (Before Submitting)

```typescript
<Card className="mb-6">
  <Card.Header>
    <Card.Title className="flex items-center gap-2">
      <span>✍️</span>
      Your Solution
    </Card.Title>
  </Card.Header>
  <Card.Body>
    <textarea
      value={solution}
      onChange={(e) => setSolution(e.target.value)}
      placeholder="Write your solution here... Show your work!"
      className="w-full h-48 p-4 border-2 border-gray-200 rounded-2xl 
                 focus:border-primary-500 focus:ring-2 focus:ring-primary-200
                 resize-none"
    />
    <Button
      onClick={handleSubmit}
      disabled={!solution.trim()}
      className="mt-4"
      fullWidth
      size="lg"
    >
      <span className="mr-2">🚀</span>
      Submit Solution
    </Button>
  </Card.Body>
</Card>
```

**Styling:**
- Large text area (h-48)
- Extra rounded corners
- Bright submit button
- Emoji for encouragement
- Disabled state when empty

---

#### 3. Locked State (Before Submission)

```typescript
<Card className="bg-gray-50 border-2 border-dashed border-gray-300">
  <Card.Body className="text-center py-12">
    <div className="text-6xl mb-4">🔒</div>
    <h3 className="text-xl font-bold text-gray-700 mb-2">
      Other Students' Solutions
    </h3>
    <p className="text-gray-600 mb-4">
      Submit your solution to see what other students wrote!
    </p>
    <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
      <span>👥</span>
      <span>{submissionCount} students have submitted</span>
    </div>
  </Card.Body>
</Card>
```

**Styling:**
- Dashed border (indicates locked)
- Gray background
- Large lock emoji
- Encouraging copy
- Shows count to create FOMO

---

#### 4. Unlocked State (After Submission)

```typescript
{/* Celebration Banner */}
<div className="bg-gradient-to-r from-primary-500 to-accent-blue 
                rounded-2xl p-6 mb-6 text-white">
  <div className="flex items-center gap-3">
    <span className="text-4xl">🎉</span>
    <div>
      <h3 className="text-xl font-bold">Great job!</h3>
      <p>You can now see what others wrote</p>
    </div>
  </div>
</div>

{/* Your Submission */}
<Card className="mb-6 border-2 border-primary-500">
  <Card.Header>
    <div className="flex items-center justify-between">
      <Card.Title className="flex items-center gap-2">
        <span>✅</span>
        Your Solution
      </Card.Title>
      <Button variant="outline" size="sm" onClick={handleEdit}>
        Edit
      </Button>
    </div>
  </Card.Header>
  <Card.Body>
    <p className="text-gray-700 whitespace-pre-wrap mb-3">
      {userSubmission.content}
    </p>
    <p className="text-sm text-gray-500">
      Submitted {formatDistanceToNow(userSubmission.submitted_at)} ago
    </p>
  </Card.Body>
</Card>

{/* Other Submissions */}
<Card>
  <Card.Header>
    <Card.Title className="flex items-center gap-2">
      <span>💬</span>
      Other Students' Solutions ({submissions.length})
    </Card.Title>
  </Card.Header>
  <Card.Body>
    <div className="space-y-4">
      {submissions.map(submission => (
        <div
          key={submission.id}
          className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 
                     transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl">👤</div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-gray-900">
                  {submission.profiles.full_name}
                </p>
                <p className="text-sm text-gray-500">
                  {formatDistanceToNow(submission.submitted_at)} ago
                </p>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">
                {submission.content}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </Card.Body>
</Card>
```

**Styling:**
- Celebration banner with gradient
- Your submission highlighted with border
- Other submissions in gray cards
- Hover effects
- Clean spacing
- Emojis for personality

---

### Teacher View Design

Teachers see everything immediately (no lock):

```
┌─────────────────────────────────────────────────┐
│ 📚 Challenge: Algebra Problem #42               │
│ Assigned to: Math 101, Algebra 1                │
│                                                 │
│ [Edit Challenge] [Delete]                       │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 📊 Submission Stats                             │
│                                                 │
│ ✅ 12 submitted  ⏳ 8 pending                   │
│                                                 │
│ Progress: ████████░░░░░░░░ 60%                 │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 💬 All Submissions (12)                         │
│                                                 │
│ [Same submission cards as student view]         │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ ⏳ Students Who Haven't Submitted (8)           │
│                                                 │
│ • John Smith                                    │
│ • Lisa Wong                                     │
│ • ...                                           │
└─────────────────────────────────────────────────┘
```

**Teacher-Specific Features:**
- Stats dashboard
- Progress bar
- List of non-submitters
- Edit/delete controls
- No locked state

---

## Animation & Interactions

### Unlock Animation
When student submits, trigger:
1. Success toast: "Solution submitted! 🎉"
2. Fade out locked section
3. Fade in celebration banner
4. Slide in submissions from bottom
5. Confetti effect (optional)

### Submission Card Hover
```css
.submission-card {
  transition: all 0.2s ease;
}
.submission-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0,0,0,0.1);
}
```

### Loading States
- Skeleton loaders for submissions
- Spinner on submit button
- Optimistic UI updates

---

## Responsive Design

### Mobile (< 768px)
- Stack everything vertically
- Full-width cards
- Larger touch targets
- Simplified header

### Tablet (768px - 1024px)
- 2-column grid for submissions
- Comfortable spacing

### Desktop (> 1024px)
- 3-column grid for submissions
- Sidebar for stats (teacher view)
- More whitespace

---

## Accessibility

- Proper heading hierarchy (h1 → h2 → h3)
- ARIA labels on interactive elements
- Keyboard navigation support
- Screen reader announcements for state changes
- High contrast mode support
- Focus indicators

---

## Technical Implementation

### State Management
```typescript
interface ChallengePageState {
  challenge: Challenge | null
  userSubmission: Submission | null
  otherSubmissions: Submission[]
  hasSubmitted: boolean
  isTeacher: boolean
  loading: boolean
}
```

### Key Functions
```typescript
// Check if user has submitted
async function checkSubmissionStatus()

// Submit solution
async function handleSubmit(content: string)

// Load other submissions (only if submitted or teacher)
async function loadSubmissions()

// Edit submission
async function handleEdit(newContent: string)
```

### RLS Policies
- Students can only see submissions if they've submitted
- Teachers can always see all submissions
- Users can only edit their own submissions

---

## Success Metrics

- **Engagement**: % of students who submit
- **Curiosity**: Time spent viewing others' solutions
- **Learning**: Quality of submissions improves over time
- **Retention**: Students return for next challenge

---

This design creates an engaging, gamified experience that encourages participation while maintaining the educational value!
