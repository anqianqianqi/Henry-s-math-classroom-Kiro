# Design Document: Bubble Room Q&A

## Overview

The Bubble Room is an animated Q&A space embedded within the Henry Math Classroom platform. Students post
questions (linked optionally to a challenge) and receive responses from classmates or Henry. The signature
experience is a floating-bubble animation driven by a weighted-shuffle ordering that surfaces newer questions
more often. Duplicate detection (Jaccard similarity) warns students before they post a near-duplicate question.
Real-time subscriptions via Supabase Realtime keep all class members synchronized without page reloads.

The feature is scoped to a single class: each class has its own Bubble Room, accessible at
`/classes/[classId]/bubble-room`. Access control and data isolation are enforced via Supabase RLS policies.

### Key Design Goals

- **Playful, low-friction UX**: the animated bubble canvas is the primary interface; forms and modals are
  secondary overlays.
- **Real-time**: questions and responses propagate to all class members within a few seconds via Supabase
  Realtime channels.
- **Client-side algorithms**: Jaccard similarity and weighted shuffle run entirely in the browser; no
  additional server infrastructure is required.
- **Composable components**: follows the existing project component hierarchy (atoms → molecules → organisms
  → pages) defined in `COMPONENT_DESIGN.md`.

---

## Architecture


```
Browser (Next.js Client Components)
│
├── BubbleRoomPage              ← page-level orchestrator
│   ├── BubbleAnimationEngine   ← canvas + animation loop
│   │   └── QuestionBubble[]    ← individual animated bubbles
│   ├── SearchBar               ← debounced keyword filter (pauses animation)
│   ├── QuestionDetailModal     ← expanded question + responses
│   ├── QuestionCompositionForm ← new question form
│   └── DuplicateDetectionModal ← similarity warning
│
├── lib/utils/bubbleRoom.ts     ← computeWeight + weightedShuffle + jaccardSimilarity (pure functions)
│
└── app/classes/[classId]/bubble-room/page.tsx  ← Next.js route / Server Component shell

Supabase (backend)
│
├── bubble_room_questions        ← questions table (RLS-protected)
├── bubble_room_responses        ← responses table (RLS-protected)
├── bubble_room_question_views   ← per-user view tracking table (RLS-protected)
│
├── Realtime channels
│   ├── bubble_room_questions    ← INSERT / DELETE events → BubbleRoomPage
│   └── bubble_room_responses    ← INSERT / DELETE events → QuestionDetailModal
│
└── RLS policies
    ├── class-scoped read / insert for students
    └── cascade delete with teacher / author checks
```

### Technology Choices

| Concern | Choice | Rationale |
|---|---|---|
| Animation | CSS keyframe animations + React state | Matches existing `AnimatedRoomLayer` pattern in the codebase; no extra libraries |
| Real-time | Supabase Realtime (Postgres changes) | Already used across the app; zero additional infrastructure |
| Duplicate detection | Client-side Jaccard (TypeScript) | Pure function, no latency, no cost; sufficient for classroom-scale question sets |
| Weighted shuffle | Client-side (TypeScript) | Pure function; easy to test and reason about |
| Search debounce | `useCallback` + `setTimeout` (300 ms) | Lightweight; no additional library needed |
| Server Actions | Next.js Server Actions | Consistent with current project patterns (e.g. `/app/api/` routes) |

---

## Components and Interfaces

### Component Hierarchy

```
app/classes/[classId]/bubble-room/
  page.tsx                       ← Server Component; fetches initial questions server-side
  
components/bubble-room/
  BubbleRoomPage.tsx             ← 'use client' orchestrator
  BubbleAnimationEngine.tsx      ← animation loop + spawn logic
  QuestionBubble.tsx             ← single animated bubble element
  QuestionDetailModal.tsx        ← question detail + response list + response form
  QuestionCompositionForm.tsx    ← new question textarea + submit
  DuplicateDetectionModal.tsx    ← duplicate warning with match list
  SearchBar.tsx                  ← debounced search input

lib/utils/bubbleRoom.ts          ← weightedShuffle, jaccardSimilarity, normalizeTokens
```

### BubbleRoomPage


**Role**: Page-level orchestrator. Owns all shared state and wires child components together.

```typescript
interface BubbleRoomPageProps {
  classId: string
  initialQuestions: BubbleQuestion[]  // hydrated server-side
  currentUserId: string
  currentUserRole: 'teacher' | 'student'
  currentUserDisplayName: string
}
```

State owned:
- `questions: BubbleQuestion[]` — full list; updated via Realtime subscription
- `searchQuery: string` — active search; empty string = animation mode
- `selectedQuestion: BubbleQuestion | null` — which question's detail modal is open
- `showCompositionForm: boolean`
- `pendingQuestion: string` — draft text while duplicate modal is open
- `duplicateMatches: DuplicateMatch[]` — matches awaiting user decision

### BubbleAnimationEngine

**Role**: Manages the CSS animation cycle. Receives an ordered question list and renders floating bubbles.

```typescript
interface BubbleAnimationEngineProps {
  questions: BubbleQuestion[]       // weighted-shuffled order
  isActive: boolean                 // false when search is active
  onBubbleClick: (q: BubbleQuestion) => void
}

interface BubbleInstance {
  question: BubbleQuestion
  id: string              // animation instance id
  x: number               // 0–100 (% viewport width)
  drift: number           // ±5–15 (% vw lateral drift)
  speed: number           // 6–14 seconds
  startedAt: number       // Date.now()
}
```

Cycle logic:
1. Maintain a `cycleQueue: BubbleQuestion[]` — a copy of the weighted-shuffled order.
2. Every ~2 seconds, pop from `cycleQueue` and spawn a new `BubbleInstance` with random params.
3. When `cycleQueue` is empty, recompute weighted shuffle and start a new cycle.
4. Keep a `visible: BubbleInstance[]` list; remove instances after their animation ends (~14 s max).
5. Clamp visible count to [3, 7]: if count < 3, spawn immediately; if count = 7, hold until one completes.

### QuestionBubble

**Role**: Single animated bubble. Pure presentational.

```typescript
interface QuestionBubbleProps {
  instance: BubbleInstance
  onClick: () => void
}
```

Renders a `<div>` with inline CSS custom properties (`--x`, `--drift`, `--speed`) consumed by a `@keyframes bubble-rise` animation (translate from bottom, fade out near top, lateral drift via sine-like CSS). Shows a truncated question preview (≤ 60 chars).

### QuestionDetailModal

**Role**: Expanded question with responses and a reply form.

```typescript
interface QuestionDetailModalProps {
  question: BubbleQuestion
  responses: BubbleResponse[]
  currentUserId: string
  currentUserRole: 'teacher' | 'student'
  currentUserDisplayName: string
  onClose: () => void
  onResponseSubmitted: () => void
  onDeleteQuestion: (questionId: string) => void
  onDeleteResponse: (responseId: string) => void
}
```

### QuestionCompositionForm

**Role**: Textarea + submit button for new questions. Receives optional `challengeId` when opened from a challenge page.

```typescript
interface QuestionCompositionFormProps {
  classId: string
  challengeId?: string     // pre-populated when opened from challenge context
  initialText?: string     // pre-populated from search query or "go back" cancel
  onSubmitted: () => void
  onClose: () => void
}
```

### DuplicateDetectionModal

**Role**: Shows up to 3 similar questions with scores; asks user to confirm or go back.

```typescript
interface DuplicateDetectionModalProps {
  matches: DuplicateMatch[]          // sorted descending by score, max 3
  onConfirm: () => void              // "Yes, post anyway"
  onCancel: () => void               // "No, go back"
}

interface DuplicateMatch {
  question: BubbleQuestion
  score: number  // 0.0–1.0
}
```

### SearchBar

**Role**: Controlled input with 300 ms debounce. Calls `onSearch` when the debounced value changes.

```typescript
interface SearchBarProps {
  value: string
  onChange: (query: string) => void
  maxLength?: number   // default 200
}
```

---

## Data Models

### bubble_room_questions


```sql
CREATE TABLE bubble_room_questions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id     uuid        NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id uuid        REFERENCES daily_challenges(id) ON DELETE SET NULL,
  text         text        NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_brq_class_id    ON bubble_room_questions(class_id);
CREATE INDEX idx_brq_user_id     ON bubble_room_questions(user_id);
CREATE INDEX idx_brq_created_at  ON bubble_room_questions(class_id, created_at DESC);
```

### bubble_room_responses

```sql
CREATE TABLE bubble_room_responses (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid        NOT NULL REFERENCES bubble_room_questions(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text        text        NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_brr_question_id ON bubble_room_responses(question_id);
CREATE INDEX idx_brr_user_id     ON bubble_room_responses(user_id);
```

### bubble_room_question_views

Tracks per-user views for engagement scoring. One row per (question, user) pair — upserted on open.

```sql
CREATE TABLE bubble_room_question_views (
  question_id uuid        NOT NULL REFERENCES bubble_room_questions(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, user_id)
);

CREATE INDEX idx_brvw_question_id ON bubble_room_question_views(question_id);
```

### TypeScript interfaces

```typescript
// lib/types/bubbleRoom.ts

export interface BubbleQuestion {
  id: string
  class_id: string
  user_id: string
  challenge_id: string | null
  text: string
  created_at: string           // ISO 8601
  updated_at: string
  author_display_name: string  // joined from profiles
  response_count: number       // denormalized count from bubble_room_responses
  unique_view_count: number    // denormalized count from bubble_room_question_views
}

export interface BubbleResponse {
  id: string
  question_id: string
  user_id: string
  text: string
  created_at: string
  responder_display_name: string   // joined from profiles
  responder_role: 'teacher' | 'student'
}
```

### RLS Policies

**bubble_room_questions**

```sql
-- Enable RLS
ALTER TABLE bubble_room_questions ENABLE ROW LEVEL SECURITY;

-- SELECT: only questions from classes the current user is an active member of
CREATE POLICY "brq_select"
  ON bubble_room_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_members cm
      WHERE cm.class_id = bubble_room_questions.class_id
        AND cm.user_id  = auth.uid()
    )
  );

-- INSERT: only into classes the user is an active member of;
--         challenge_id class must match question class
CREATE POLICY "brq_insert"
  ON bubble_room_questions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM class_members cm
      WHERE cm.class_id = bubble_room_questions.class_id
        AND cm.user_id  = auth.uid()
    )
    AND (
      challenge_id IS NULL
      OR EXISTS (
        SELECT 1 FROM challenge_assignments ca
        WHERE ca.challenge_id = bubble_room_questions.challenge_id
          AND ca.class_id     = bubble_room_questions.class_id
      )
    )
  );

-- DELETE: own question (any role) OR teacher role
CREATE POLICY "brq_delete"
  ON bubble_room_questions FOR DELETE
  USING (
    user_id = auth.uid()
    OR user_has_permission(auth.uid(), 'class:update', class_id)
  );
```

**bubble_room_responses**

```sql
ALTER TABLE bubble_room_responses ENABLE ROW LEVEL SECURITY;

-- SELECT: if the user can read the parent question
CREATE POLICY "brr_select"
  ON bubble_room_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM bubble_room_questions q
      JOIN class_members cm ON cm.class_id = q.class_id
      WHERE q.id         = bubble_room_responses.question_id
        AND cm.user_id   = auth.uid()
    )
  );

-- INSERT: user is enrolled in the question's class
CREATE POLICY "brr_insert"
  ON bubble_room_responses FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM bubble_room_questions q
      JOIN class_members cm ON cm.class_id = q.class_id
      WHERE q.id       = bubble_room_responses.question_id
        AND cm.user_id = auth.uid()
    )
  );

-- DELETE: own response OR teacher
CREATE POLICY "brr_delete"
  ON bubble_room_responses FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM bubble_room_questions q
      WHERE q.id = bubble_room_responses.question_id
        AND user_has_permission(auth.uid(), 'class:update', q.class_id)
    )
  );
```

---

## API Routes / Server Actions

All mutations are Next.js Server Actions in `app/classes/[classId]/bubble-room/actions.ts`.
Read-only data is fetched server-side in `page.tsx` for initial hydration; subsequent updates arrive via Realtime.

### `postQuestion(classId, text, challengeId?)`

```
Validate: text non-empty, trimmed length ≤ 2000
Validate: challengeId (if provided) belongs to classId
Insert into bubble_room_questions
Return: BubbleQuestion
```

### `postResponse(questionId, text)`

```
Validate: text non-empty, trimmed length ≤ 2000
Resolve classId from questionId
Insert into bubble_room_responses
Return: BubbleResponse
```

### `deleteQuestion(questionId)`

```
RLS enforces authorization at DB level
Delete row from bubble_room_questions (CASCADE deletes responses)
Return: { success: true }
```

### `deleteResponse(responseId)`

```
RLS enforces authorization at DB level
Delete row from bubble_room_responses
Return: { success: true }
```

### `getResponses(questionId)`

```
SELECT responses + author profiles for questionId
Ordered by created_at ASC
Return: BubbleResponse[]
```

> Duplicate detection (`checkDuplicates`) runs entirely on the client using the pre-loaded `questions` list.
> No server round-trip is needed.

---

## Duplicate Detection Algorithm


**Location**: `lib/utils/bubbleRoom.ts` (pure functions, no side effects)

### Token Normalization

```typescript
/**
 * Normalize a string to a set of meaningful tokens.
 * Lowercase, strip punctuation, split on whitespace, drop stopwords.
 */
export function normalizeTokens(text: string): Set<string> {
  const STOPWORDS = new Set(['a','an','the','is','are','was','were',
    'i','my','we','our','you','your','it','its','this','that',
    'in','on','at','to','for','of','and','or','but','not','do','does','did'])
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0 && !STOPWORDS.has(t))
  )
}
```

### Jaccard Similarity

```typescript
/**
 * Compute Jaccard similarity between two token sets.
 * Returns 0.0 for two empty sets to avoid 0/0.
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  const intersection = new Set([...a].filter(t => b.has(t)))
  const union = new Set([...a, ...b])
  return intersection.size / union.size
}
```

### Duplicate Check Flow

```typescript
export interface DuplicateMatch {
  question: BubbleQuestion
  score: number
}

const DUPLICATE_THRESHOLD = 0.7
const MAX_MATCHES = 3

export function findDuplicates(
  candidateText: string,
  existingQuestions: BubbleQuestion[]
): DuplicateMatch[] {
  const candidateTokens = normalizeTokens(candidateText)
  return existingQuestions
    .map(q => ({
      question: q,
      score: jaccardSimilarity(candidateTokens, normalizeTokens(q.text))
    }))
    .filter(m => m.score >= DUPLICATE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MATCHES)
}
```

**Complexity**: O(n × |tokens|) where n is the number of existing questions in the class.
For a typical classroom (< 500 questions), this runs in < 5 ms on a modern device.

---

## Weighted Shuffle Algorithm

**Location**: `lib/utils/bubbleRoom.ts`

The ranking uses a composite engagement weight that combines recency and popularity (views + responses). Questions with more engagement float up more often, giving the Bubble Room a recommendation-system feel without any server-side precomputation.

```typescript
const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000  // 48 hours

/**
 * Compute composite weight for a question.
 * - Recency boost: questions < 48 h old get 2× base weight.
 * - Engagement boost: log-scaled so popular questions surface more often
 *   without completely dominating the cycle.
 *   engagement_score = (response_count × 3) + unique_view_count
 */
export function computeWeight(
  question: BubbleQuestion,
  now: number = Date.now()
): number {
  const ageMs = now - new Date(question.created_at).getTime()
  const recencyBoost = ageMs <= RECENT_WINDOW_MS ? 2.0 : 1.0

  const engagementScore = (question.response_count * 3) + question.unique_view_count
  // Math.log1p(0) = 0, so brand-new questions with no engagement get base weight
  const engagementBoost = 1 + Math.log1p(engagementScore)

  return recencyBoost * engagementBoost
}

/**
 * Weighted reservoir shuffle (Algorithm A-Res by Efraimidis & Spirakis).
 * Each item receives a key = u^(1/weight) where u ~ Uniform(0,1).
 * Items are sorted descending by key — higher weight → higher expected rank.
 */
export function weightedShuffle(
  questions: BubbleQuestion[],
  now: number = Date.now()
): BubbleQuestion[] {
  return questions
    .map(question => ({
      question,
      key: Math.pow(Math.random(), 1 / computeWeight(question, now))
    }))
    .sort((a, b) => b.key - a.key)
    .map(({ question }) => question)
}
```

**Why log-scale?** A question with 100 responses would otherwise get 300× the weight of a brand-new question, making the cycle deterministic. `Math.log1p` compresses the range while still rewarding popular questions.

**Responses weighted 3×?** Responses represent deeper engagement than passive views — a student took the time to reply. The 3× factor gives them proportionally more ranking power.

---

## Realtime Subscription Strategy


Two Supabase Realtime channels are opened by `BubbleRoomPage` on mount and cleaned up on unmount.

### Channel 1: Questions (class-scoped)

```typescript
supabase
  .channel(`bubble-room-questions:${classId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'bubble_room_questions',
    filter: `class_id=eq.${classId}`
  }, (payload) => {
    // Append new question to questions state; triggers animation requeue
    setQuestions(prev => [...prev, hydrateQuestion(payload.new)])
  })
  .on('postgres_changes', {
    event: 'DELETE',
    schema: 'public',
    table: 'bubble_room_questions',
    filter: `class_id=eq.${classId}`
  }, (payload) => {
    setQuestions(prev => prev.filter(q => q.id !== payload.old.id))
    // Close detail modal if deleted question was selected
    setSelectedQuestion(prev => prev?.id === payload.old.id ? null : prev)
  })
  .subscribe()
```

### Channel 2: Responses (question-scoped, lazy)

Opened only when `QuestionDetailModal` mounts (i.e., when a user expands a question). Closed when the modal closes.

```typescript
supabase
  .channel(`bubble-room-responses:${questionId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'bubble_room_responses',
    filter: `question_id=eq.${questionId}`
  }, (payload) => {
    setResponses(prev => [...prev, hydrateResponse(payload.new)])
  })
  .on('postgres_changes', {
    event: 'DELETE',
    schema: 'public',
    table: 'bubble_room_responses',
    filter: `question_id=eq.${questionId}`
  }, (payload) => {
    setResponses(prev => prev.filter(r => r.id !== payload.old.id))
  })
  .subscribe()
```

**Note**: Supabase Realtime payloads for DELETE events only include the primary key in `payload.old` by default.
The `bubble_room_questions` and `bubble_room_responses` tables should have `REPLICA IDENTITY DEFAULT` (the default),
which exposes the PK on DELETE.

---

## Data Flow Diagrams

### 1. Post a Question (no duplicate)

```
Student types question → QuestionCompositionForm.handleSubmit()
  → findDuplicates(text, questions)         [client, sync]
  → matches.length === 0 → postQuestion()   [Server Action]
    → INSERT bubble_room_questions
    → Supabase Realtime INSERT event
      → all class members: setQuestions([...questions, newQ])
      → BubbleAnimationEngine picks up new question on next cycle
```

### 2. Post a Question (duplicate detected)

```
Student types question → QuestionCompositionForm.handleSubmit()
  → findDuplicates(text, questions)
  → matches.length > 0 → setPendingQuestion(text)
                        → setDuplicateMatches(matches)
                        → show DuplicateDetectionModal

  If "Yes, post anyway":
    → postQuestion(pendingQuestion)
    → [same as no-duplicate path above]

  If "No, go back":
    → dismiss modal
    → QuestionCompositionForm re-opens with originalText = pendingQuestion
```

### 3. Respond to a Question

```
User opens QuestionDetailModal → getResponses(questionId) [Server Action]
  → display responses ordered by created_at ASC

User submits response → QuestionDetailModal.handleResponseSubmit()
  → postResponse(questionId, text)   [Server Action]
    → INSERT bubble_room_responses
    → Supabase Realtime INSERT event on responses channel
      → all viewers of that question: setResponses([...responses, newR])
```

### 4. Search Questions

```
Student types in SearchBar
  → 300 ms debounce fires
  → setSearchQuery(value)
  → BubbleRoomPage:
      if (searchQuery.length > 0):
        filtered = questions.filter(q =>
          q.text.toLowerCase().includes(searchQuery.toLowerCase())
        )
        render filtered as static list
        isActive = false  → BubbleAnimationEngine pauses
      else:
        isActive = true   → BubbleAnimationEngine resumes
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system —
essentially, a formal statement about what the system should do. Properties serve as the bridge between
human-readable specifications and machine-verifiable correctness guarantees.*

**Property Reflection**: Before listing properties, redundancies were identified and resolved:

- Properties 1.1 (question persistence) and 3.3 (response persistence) are structurally identical round-trip
  tests; they are kept separate because the data models differ.
- Properties 6.2 and 7.2 (cascade delete question) are identical — merged into one property.
- Properties 6.1/6.3 (teacher sees delete) and 7.1/7.3 (author sees delete) are unified into a single
  visibility property covering both actors.
- Properties 3.1 and 3.2 (detail view ordering + field presence) are merged into one rendering property.
- Properties 5.2 and 5.3 (weight assignment and shuffle freshness) are kept separate because they validate
  different algorithmic aspects.

---

### Property 1: Question persistence round-trip

*For any* valid question payload (non-empty text ≤ 2000 chars, any valid class_id, optional challenge_id),
inserting the question and immediately reading it back SHALL return a record with all fields equal to the
submitted values.

**Validates: Requirements 1.1, 1.3**

---

### Property 2: Whitespace-only inputs are rejected

*For any* string composed entirely of whitespace characters (spaces, tabs, newlines, or combinations thereof),
attempting to submit it as a question or as a response SHALL be rejected, leaving the question/response count
unchanged.

**Validates: Requirements 1.4, 3.4**

---

### Property 3: Jaccard similarity is symmetric, bounded, and exact at extremes

*For any* two non-empty strings `a` and `b`:
- `jaccardSimilarity(normalizeTokens(a), normalizeTokens(b))` is in the range [0.0, 1.0]
- `jaccardSimilarity(normalizeTokens(a), normalizeTokens(b)) === jaccardSimilarity(normalizeTokens(b), normalizeTokens(a))`
- If `a` and `b` have identical normalized token sets, the score SHALL equal 1.0
- If `a` and `b` share no normalized tokens, the score SHALL equal 0.0

**Validates: Requirements 2.1**

---

### Property 4: Duplicate match list is bounded, sorted, and threshold-filtered

*For any* candidate question text and any non-empty list of existing questions, the result of `findDuplicates`
SHALL contain at most 3 entries, each with score ≥ 0.7, sorted in descending order of score.

**Validates: Requirements 2.2**

---

### Property 5: Duplicate modal cancel preserves original text

*For any* question text string `t`, after opening the DuplicateDetectionModal and selecting "No, go back",
the QuestionCompositionForm SHALL display text equal to `t`.

**Validates: Requirements 2.4**

---

### Property 6: Below-threshold questions proceed without modal

*For any* candidate text where `findDuplicates` returns an empty list (all existing question scores < 0.7),
submitting the form SHALL not display the DuplicateDetectionModal.

**Validates: Requirements 2.5**

---

### Property 7: Question detail view shows responses in chronological order with required fields

*For any* set of response objects with varying `created_at` values, the QuestionDetailModal SHALL render them
in strictly ascending `created_at` order, and each rendered response SHALL include the responder's display
name, role indicator (student or Henry), and timestamp.

**Validates: Requirements 3.1, 3.2**

---

### Property 8: Response persistence round-trip

*For any* valid response payload (non-empty text ≤ 2000 chars, any valid question_id), inserting the response
and immediately reading it back SHALL return a record with all fields equal to the submitted values.

**Validates: Requirements 3.3**

---

### Property 9: Search filter is exhaustive and case-insensitive

*For any* list of questions and any non-empty search query `q`, the filtered result SHALL contain exactly
those questions whose `text` contains `q` as a case-insensitive substring — no false positives and no false
negatives.

**Validates: Requirements 4.2**

---

### Property 10: Active search pauses the animation engine

*For any* non-empty search query string set as the active search, the BubbleAnimationEngine `isActive` prop
SHALL be `false`.

**Validates: Requirements 4.5**

---

### Property 11: Weight assignment is correct for any question age

*For any* question with `created_at` timestamp `t` and reference time `now`:
- If `now - t ≤ 48 hours`, `assignWeights` SHALL assign weight 2
- If `now - t > 48 hours`, `assignWeights` SHALL assign weight 1

**Validates: Requirements 5.2**

---

### Property 12: Weighted shuffle produces different orderings across cycles

*For any* list of ≥ 3 questions, calling `weightedShuffle` twice SHALL produce a different ordering with
probability > 0.95 (verified over ≥ 100 iterations).

**Validates: Requirements 5.3**

---

### Property 13: Bubble animation parameters are within specified ranges

*For any* generated bubble instance parameters:
- Horizontal start position `x` SHALL be in [0, 100] (% viewport width)
- Lateral drift magnitude `|drift|` SHALL be in [5, 15] (% viewport width)
- Rise speed SHALL be in [6, 14] (seconds)

**Validates: Requirements 5.4**

---

### Property 14: Delete action visibility follows authorship and role rules

*For any* (content, viewerUserId, viewerRole) triple:
- The delete action SHALL be visible if `viewerUserId === content.user_id` OR `viewerRole === 'teacher'`
- The delete action SHALL NOT be visible otherwise

**Validates: Requirements 6.1, 6.3, 7.1, 7.3, 7.5**

---

### Property 15: Cascade delete removes all child responses

*For any* question with an arbitrary number of associated responses, deleting that question SHALL result in
zero responses with that `question_id` remaining in the store.

**Validates: Requirements 6.2, 7.2**

---

### Property 16: Class/challenge ID consistency at INSERT time

*For any* (questionClassId, challengeClassId) pair, a question INSERT SHALL succeed iff
`questionClassId === challengeClassId` (when `challengeId` is non-null).

**Validates: Requirements 8.5**

---

## Error Handling


| Scenario | Handling |
|---|---|
| Duplicate detection throws (Req 2.6) | Catch in `handleSubmit`; proceed with submission; `console.error` silently |
| `postQuestion` Server Action fails | Display inline error in `QuestionCompositionForm`; preserve draft text |
| `postResponse` fails | Display inline error in `QuestionDetailModal`; preserve response draft |
| `deleteQuestion` / `deleteResponse` fails | Display inline error; dismiss confirm prompt; leave content unchanged |
| Search filter fails (client error) | Display inline error; leave search input intact |
| Realtime subscription disconnects | Supabase client auto-reconnects; no user-visible impact |
| User navigates away mid-animation | `useEffect` cleanup cancels `setInterval` and calls `supabase.removeChannel()` |
| Unauthenticated access | Detected in the Server Component `page.tsx`; redirect to `/login` via `redirect()` |
| RLS rejection on INSERT | Server Action receives Supabase error; maps to user-friendly message |

All Server Actions follow this error pattern:

```typescript
try {
  const { data, error } = await supabase.from('bubble_room_questions').insert(...)
  if (error) throw error
  return { data }
} catch (err) {
  console.error('[BubbleRoom] postQuestion:', err)
  return { error: 'Failed to post your question. Please try again.' }
}
```

---

## Testing Strategy

### Unit Tests

Located in `lib/utils/__tests__/bubbleRoom.test.ts`. Focus on pure functions.

| Test | What it covers |
|---|---|
| `normalizeTokens` — known inputs | Stopword removal, punctuation stripping, case folding |
| `jaccardSimilarity` — known pairs | Score = 1.0 for identical sets, 0.0 for disjoint, 0.5 for half-overlap |
| `findDuplicates` — threshold filtering | No results when all scores < 0.7, max 3 results, sorted descending |
| `assignWeights` — recent vs. old | Weight 2 for < 48 h, weight 1 for > 48 h, boundary at exactly 48 h |
| `weightedShuffle` — all items present | Output contains every input question exactly once |

### Property-Based Tests

Located in `lib/utils/__tests__/bubbleRoom.pbt.test.ts`. Uses **fast-check** (already available in the JS ecosystem; install with `npm install --save-dev fast-check`). Each test runs **100 iterations minimum**.

```typescript
// Example property test structure

import fc from 'fast-check'
import { jaccardSimilarity, normalizeTokens, findDuplicates,
         assignWeights, weightedShuffle } from '../bubbleRoom'

// Feature: bubble-room-qa, Property 3: Jaccard similarity bounds and symmetry
test('Property 3: jaccardSimilarity is symmetric and in [0,1]', () => {
  fc.assert(fc.property(
    fc.string({ minLength: 1 }), fc.string({ minLength: 1 }),
    (a, b) => {
      const tokA = normalizeTokens(a)
      const tokB = normalizeTokens(b)
      const ab = jaccardSimilarity(tokA, tokB)
      const ba = jaccardSimilarity(tokB, tokA)
      return ab >= 0 && ab <= 1 && Math.abs(ab - ba) < 1e-10
    }
  ), { numRuns: 100 })
})

// Feature: bubble-room-qa, Property 4: Duplicate match list is bounded, sorted, threshold-filtered
test('Property 4: findDuplicates returns ≤ 3, score ≥ 0.7, sorted descending', () => {
  // ...
})

// Feature: bubble-room-qa, Property 11: Weight assignment correctness
test('Property 11: assignWeights gives weight 2 for recent, 1 for old', () => {
  fc.assert(fc.property(
    fc.integer({ min: 0, max: 48 * 60 * 60 * 1000 - 1 }),   // recent
    fc.integer({ min: 48 * 60 * 60 * 1000 + 1, max: 365 * 24 * 60 * 60 * 1000 }), // old
    (recentAgeMs, oldAgeMs) => {
      const now = Date.now()
      const recentQ = { created_at: new Date(now - recentAgeMs).toISOString() } as any
      const oldQ    = { created_at: new Date(now - oldAgeMs).toISOString() }    as any
      const [r, o]  = assignWeights([recentQ, oldQ], now)
      return r.weight === 2 && o.weight === 1
    }
  ), { numRuns: 100 })
})
```

**Tag format for each property test**: `// Feature: bubble-room-qa, Property N: <property_text>`

### Component Tests

Located in `components/bubble-room/__tests__/`. Uses Vitest + React Testing Library.

| Component | Test cases |
|---|---|
| `QuestionCompositionForm` | Renders with optional challengeId, validates empty/whitespace input, calls onSubmitted |
| `DuplicateDetectionModal` | Renders up to 3 matches, onConfirm fires "yes", onCancel fires with original text |
| `SearchBar` | Debounce: onChange not called until 300 ms after last keystroke |
| `QuestionDetailModal` | Responses in chronological order, delete visible to author, not to others |
| `BubbleAnimationEngine` | Empty state renders when questions = [], pauses when isActive = false |

### Integration Tests

Test Supabase RLS policies against a local Supabase instance (`supabase start`).

| Test | What it verifies |
|---|---|
| Non-enrolled student SELECT | Returns empty result set (not error) |
| Non-enrolled student INSERT | Rejected by RLS |
| Challenge class_id mismatch | INSERT rejected |
| Cascade delete | All responses removed when question deleted |
| Realtime INSERT propagation | Subscribed client receives INSERT event within 5 s |
