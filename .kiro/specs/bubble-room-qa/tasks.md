# Implementation Plan: Bubble Room Q&A

## Overview

Implement the Bubble Room Q&A feature — an animated, real-time Q&A space for Henry Math Classroom. Students post questions (optionally linked to a challenge), respond to classmates, and see floating bubbles rise on screen. The implementation follows the project's component hierarchy (atoms → molecules → organisms → pages), uses Supabase for persistence and Realtime, and runs duplicate detection and weighted shuffle entirely on the client.

## Tasks

- [ ] 1. Database schema, types, and utility functions
  - [ ] 1.1 Create Supabase migration SQL for bubble room tables and RLS policies
    - Create `bubble_room_questions` table with columns: `id`, `class_id`, `user_id`, `challenge_id`, `text`, `created_at`, `updated_at`; add indexes on `class_id`, `user_id`, `(class_id, created_at DESC)`
    - Create `bubble_room_responses` table with columns: `id`, `question_id`, `user_id`, `text`, `created_at`; add indexes on `question_id`, `user_id`
    - Create `bubble_room_question_views` table with columns: `question_id`, `user_id`, `viewed_at`; PRIMARY KEY (question_id, user_id); index on `question_id`
    - Write `brq_select`, `brq_insert`, `brq_delete` RLS policies for `bubble_room_questions` as specified in design
    - Write `brr_select`, `brr_insert`, `brr_delete` RLS policies for `bubble_room_responses` as specified in design
    - Write `brvw_select`, `brvw_upsert` RLS policies for `bubble_room_question_views` (enrolled students can read/upsert their own view records)
    - Save as `supabase/add-bubble-room.sql`
    - _Requirements: 1.1, 8.1, 8.3, 8.4, 8.5_

  - [ ] 1.2 Create TypeScript type definitions
    - Create `lib/types/bubbleRoom.ts` exporting `BubbleQuestion` (with `response_count` and `unique_view_count` fields), `BubbleResponse`, `DuplicateMatch`, `BubbleInstance` interfaces exactly as defined in the design
    - _Requirements: 1.1, 3.3_

  - [ ] 1.3 Implement pure utility functions in `lib/utils/bubbleRoom.ts`
    - Implement `normalizeTokens(text: string): Set<string>` — lowercase, strip punctuation, split on whitespace, drop stopwords
    - Implement `jaccardSimilarity(a: Set<string>, b: Set<string>): number` — returns 0.0 for two empty sets
    - Implement `findDuplicates(candidateText, existingQuestions): DuplicateMatch[]` — threshold 0.7, max 3 results, sorted descending
    - Implement `computeWeight(question, now?)` — composite weight: recencyBoost (2× for < 48h) × engagementBoost (1 + log1p(response_count×3 + unique_view_count))
    - Implement `weightedShuffle(questions, now?)` — Algorithm A-Res reservoir sampling using `computeWeight`
    - _Requirements: 2.1, 2.2, 5.2, 5.3_

  - [ ]* 1.4 Write unit tests for utility functions in `lib/utils/__tests__/bubbleRoom.test.ts`
    - Test `normalizeTokens`: stopword removal, punctuation stripping, case folding
    - Test `jaccardSimilarity`: score 1.0 for identical sets, 0.0 for disjoint, 0.5 for half-overlap
    - Test `findDuplicates`: no results when all scores < 0.7, max 3 results, sorted descending
    - Test `assignWeights`: weight 2 for < 48 h, weight 1 for > 48 h, boundary at exactly 48 h
    - Test `weightedShuffle`: output contains every input question exactly once
    - _Requirements: 2.1, 2.2, 5.2, 5.3_

  - [ ]* 1.5 Write property-based tests in `lib/utils/__tests__/bubbleRoom.pbt.test.ts`
    - **Property 3: Jaccard similarity is symmetric, bounded [0,1], equals 1.0 for identical token sets, 0.0 for disjoint** — `fc.string({ minLength: 1 })` × 2; 100 runs
    - **Property 4: `findDuplicates` returns ≤ 3 entries, each score ≥ 0.7, sorted descending** — arbitrary candidate text + question list; 100 runs
    - **Property 11: `assignWeights` assigns weight 2 for ≤ 48 h, weight 1 for > 48 h** — arbitrary recent/old age pairs; 100 runs
    - **Property 12: `weightedShuffle` produces different orderings across calls with probability > 0.95** — list of ≥ 3 questions; ≥ 100 iterations
    - **Validates: Requirements 2.1, 2.2, 5.2, 5.3**

- [ ] 2. Server Actions
  - [ ] 2.1 Create `app/classes/[classId]/bubble-room/actions.ts` with all Server Actions
    - Implement `postQuestion(classId, text, challengeId?)`: validate text non-empty and ≤ 2000 chars, validate `challengeId` class match, insert into `bubble_room_questions`, return `BubbleQuestion`
    - Implement `postResponse(questionId, text)`: validate text, resolve `classId`, insert into `bubble_room_responses`, return `BubbleResponse`
    - Implement `recordView(questionId)`: upsert into `bubble_room_question_views` for the current user; called silently when QuestionDetailModal opens
    - Implement `deleteQuestion(questionId)`: RLS-guarded delete (cascades to responses and views), return `{ success: true }`
    - Implement `deleteResponse(responseId)`: RLS-guarded delete, return `{ success: true }`
    - Implement `getResponses(questionId)`: SELECT responses + author profiles ordered by `created_at ASC`, return `BubbleResponse[]`
    - When fetching questions, include `response_count` (COUNT from bubble_room_responses) and `unique_view_count` (COUNT from bubble_room_question_views) as computed fields
    - All actions follow the try/catch pattern from design; map RLS errors to user-friendly messages
    - _Requirements: 1.1, 1.3, 1.4, 1.6, 3.3, 3.4, 6.2, 6.4, 7.2, 7.4, 8.3, 8.4, 8.5_

  - [ ]* 2.2 Write unit tests for Server Actions in `app/classes/[classId]/bubble-room/__tests__/actions.test.ts`
    - Mock Supabase client; test validation paths (empty text rejected, whitespace-only rejected)
    - Test `challengeId` class mismatch returns error
    - Test successful insert returns correctly shaped `BubbleQuestion` / `BubbleResponse`
    - Test delete returns `{ success: true }`
    - _Requirements: 1.4, 3.4, 8.5_

- [ ] 3. Checkpoint — utility functions and server actions complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. UI Components — atoms and molecules
  - [ ] 4.1 Create `components/bubble-room/SearchBar.tsx`
    - Controlled input, 300 ms debounce via `useCallback` + `setTimeout`, `maxLength` prop (default 200), calls `onChange` with debounced value
    - Show inline error when search fails
    - _Requirements: 4.1, 4.2, 4.4, 4.6_

  - [ ]* 4.2 Write unit tests for `SearchBar` in `components/bubble-room/__tests__/SearchBar.test.tsx`
    - Debounce: `onChange` is NOT called until 300 ms after last keystroke; called once after pause
    - Clearing input calls `onChange('')`
    - _Requirements: 4.2, 4.4_

  - [ ] 4.3 Create `components/bubble-room/QuestionBubble.tsx`
    - Pure presentational component; accepts `BubbleInstance` + `onClick`
    - Renders `<div>` with CSS custom properties `--x`, `--drift`, `--speed` driving `@keyframes bubble-rise`
    - Displays truncated question preview (≤ 60 chars)
    - _Requirements: 5.1, 5.4_

  - [ ] 4.4 Create `components/bubble-room/QuestionCompositionForm.tsx`
    - Textarea (max 2000 chars) + submit button; accepts `classId`, optional `challengeId`, optional `initialText`
    - Client-side validation: reject empty / whitespace-only; show inline error
    - On submit: call `findDuplicates` against parent-provided question list; if matches → invoke `onDuplicatesFound(text, matches)`; else → call `postQuestion` Server Action
    - Show inline error on Server Action failure; preserve draft text
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.5_

  - [ ]* 4.5 Write unit tests for `QuestionCompositionForm` in `components/bubble-room/__tests__/QuestionCompositionForm.test.tsx`
    - Renders with optional `challengeId` prop
    - Empty / whitespace-only text shows inline validation error, does not call `postQuestion`
    - Successful submit calls `onSubmitted`
    - _Requirements: 1.4, 2.1_

  - [ ] 4.6 Create `components/bubble-room/DuplicateDetectionModal.tsx`
    - Renders up to 3 `DuplicateMatch` items with scores; "Yes, post anyway" calls `onConfirm`; "No, go back" calls `onCancel`
    - _Requirements: 2.2, 2.3, 2.4_

  - [ ]* 4.7 Write unit tests for `DuplicateDetectionModal` in `components/bubble-room/__tests__/DuplicateDetectionModal.test.tsx`
    - Renders exactly the number of matches provided (up to 3)
    - `onConfirm` fires when user clicks "Yes, post anyway"
    - `onCancel` fires when user clicks "No, go back"
    - _Requirements: 2.2, 2.3, 2.4_

  - [ ] 4.8 Create `components/bubble-room/QuestionDetailModal.tsx`
    - On mount: call `recordView(questionId)` silently (fire-and-forget) to track engagement
    - Opens Supabase Realtime channel `bubble-room-responses:${questionId}` on mount; closes on unmount
    - Calls `getResponses` Server Action on open; displays responses in `created_at ASC` order
    - Each response shows `responder_display_name`, role indicator (student / Henry), timestamp
    - Response form: validates non-empty, calls `postResponse`, shows inline error on failure, preserves draft on failure
    - Delete actions: show "Delete Question" only for teacher or own question; show "Delete Response" only for teacher or own response
    - Calls `onDeleteQuestion` / `onDeleteResponse` with confirmation
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 4.9 Write unit tests for `QuestionDetailModal` in `components/bubble-room/__tests__/QuestionDetailModal.test.tsx`
    - Responses render in chronological order
    - Delete action visible to response author, not visible to other students
    - Delete action visible to teacher for all content
    - Empty / whitespace-only response text shows inline error
    - _Requirements: 3.1, 3.2, 3.4, 6.1, 6.3, 7.1, 7.3, 7.5_

- [ ] 5. Checkpoint — all component unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Animation engine and property-based tests for UI behavior
  - [ ] 6.1 Create `components/bubble-room/BubbleAnimationEngine.tsx`
    - Accepts `questions: BubbleQuestion[]`, `isActive: boolean`, `onBubbleClick`
    - On mount / when `questions` changes: compute `weightedShuffle` to initialize `cycleQueue`
    - Spawn loop: every ~2 s pop from `cycleQueue`, create `BubbleInstance` with random `x` ∈ [0, 100], `drift` ∈ [±5, ±15], `speed` ∈ [6, 14]; clamp visible count to [3, 7]
    - When `cycleQueue` is empty: recompute `weightedShuffle` and start new cycle
    - Remove `BubbleInstance` from `visible` after animation ends (speed + buffer ms)
    - When `isActive` is false: pause spawn loop but keep currently visible bubbles mounted
    - When `questions.length === 0`: show empty-state illustration + CTA button
    - Cleanup: `useEffect` return cancels interval + removes Realtime subscriptions
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 6.2 Write unit tests for `BubbleAnimationEngine` in `components/bubble-room/__tests__/BubbleAnimationEngine.test.tsx`
    - Empty-state renders when `questions = []`
    - Pauses spawn when `isActive = false` (no new bubbles spawned after prop change)
    - _Requirements: 5.6, 5.7_

  - [ ]* 6.3 Write property-based tests for animation and UI invariants in `lib/utils/__tests__/bubbleRoom.pbt.test.ts` (append to existing file)
    - **Property 2: Whitespace-only text is always rejected** — `fc.stringOf(fc.constantFrom(' ','\t','\n'))` for questions and responses; verify rejected without DB insert; 100 runs
    - **Property 9: Search filter is exhaustive and case-insensitive** — arbitrary question list + arbitrary query; no false positives or negatives; 100 runs
    - **Property 13: Bubble instance parameters are within spec ranges** — generate arbitrary bubble instances; verify `x ∈ [0,100]`, `|drift| ∈ [5,15]`, `speed ∈ [6,14]`; 100 runs
    - **Validates: Requirements 1.4, 3.4, 4.2, 5.4**

  - [ ]* 6.4 Write property-based tests for delete visibility and cascade in `lib/utils/__tests__/bubbleRoom.pbt.test.ts` (append)
    - **Property 14: Delete action visibility follows authorship and role rules** — arbitrary (viewerUserId, contentUserId, viewerRole); verify visibility logic; 100 runs
    - **Property 15: Cascade delete removes all child responses** — arbitrary question with N responses; after cascade delete, responses array is empty; 100 runs
    - **Property 5: Duplicate modal cancel preserves original text** — arbitrary text `t`; after cancel, form text equals `t`; 100 runs
    - **Property 6: Below-threshold candidate bypasses duplicate modal** — arbitrary question lists where all scores < 0.7; verify `findDuplicates` returns `[]`; 100 runs
    - **Property 10: Active search pauses animation engine** — any non-empty query sets `isActive = false`; 100 runs
    - **Validates: Requirements 2.4, 2.5, 6.1, 6.3, 7.1, 7.3, 7.5_

- [ ] 7. Page-level orchestration and Realtime wiring
  - [ ] 7.1 Create the Next.js Server Component at `app/classes/[classId]/bubble-room/page.tsx`
    - Verify authentication; redirect unauthenticated users to `/login` via `redirect()`
    - Fetch initial `BubbleQuestion[]` with joined author display names server-side for SSR hydration
    - Resolve `currentUserId`, `currentUserRole`, `currentUserDisplayName` from auth session
    - Render `<BubbleRoomPage>` with initial props
    - _Requirements: 8.2_

  - [ ] 7.2 Create `components/bubble-room/BubbleRoomPage.tsx` (client component orchestrator)
    - Own state: `questions`, `searchQuery`, `selectedQuestion`, `showCompositionForm`, `pendingQuestion`, `duplicateMatches`
    - Open Supabase Realtime channel `bubble-room-questions:${classId}` on mount; handle INSERT (append) and DELETE (filter + close modal if affected); clean up on unmount
    - Derive `isAnimationActive = searchQuery.length === 0`
    - When `searchQuery` non-empty: compute `filteredQuestions` via case-insensitive substring; render as static scrollable list; show "No questions found" + CTA when empty
    - When `searchQuery` empty: pass weighted-shuffled questions to `BubbleAnimationEngine`
    - Handle `onDuplicatesFound`: save `pendingQuestion` + `duplicateMatches`; show `DuplicateDetectionModal`
    - Handle duplicate modal confirm: call `postQuestion(pendingQuestion)`, reset pending state
    - Handle duplicate modal cancel: reopen `QuestionCompositionForm` with `initialText = pendingQuestion`
    - Render "Ask a Question" button (opens `QuestionCompositionForm`)
    - _Requirements: 1.2, 1.5, 2.2, 2.3, 2.4, 2.6, 3.5, 4.2, 4.3, 4.4, 4.5, 8.1_

  - [ ] 7.3 Add "Ask About This Challenge" button to challenge pages
    - In the relevant challenge page component (e.g., `app/challenges/[id]/page.tsx`), add an "Ask About This Challenge" inline button when the challenge is currently assigned and not past its due date
    - Button navigates to `/classes/[classId]/bubble-room` with `challengeId` as a query param; `QuestionCompositionForm` reads the param and pre-populates `challengeId`
    - _Requirements: 1.2, 1.3_

- [ ] 8. Checkpoint — full feature integrated and all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Final: commit and push to beta branch
  - [ ] 9.1 Stage all new and modified files and create a commit
    - Run `git add` for all bubble-room source files, migration SQL, tests, and updated challenge page
    - Commit with message: `feat: implement Bubble Room Q&A feature`
    - _Requirements: all_

  - [ ] 9.2 Push changes to the beta branch
    - Run `git push -u origin beta`
    - _Requirements: all_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using `fast-check` (already in `devDependencies`)
- Unit tests use Vitest + React Testing Library (already configured in the project)
- The duplicate detection and weighted shuffle algorithms run entirely client-side — no additional server infrastructure needed
- Supabase migration SQL (`supabase/add-bubble-room.sql`) must be applied to the Supabase project before the feature can function end-to-end

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3"] },
    { "id": 2, "tasks": ["1.4", "1.5", "2.1"] },
    { "id": 3, "tasks": ["2.2", "4.1", "4.3", "4.4", "4.6", "4.8"] },
    { "id": 4, "tasks": ["4.2", "4.5", "4.7", "4.9", "6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3", "6.4", "7.1"] },
    { "id": 6, "tasks": ["7.2"] },
    { "id": 7, "tasks": ["7.3"] },
    { "id": 8, "tasks": ["9.1"] },
    { "id": 9, "tasks": ["9.2"] }
  ]
}
```
