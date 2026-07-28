# Requirements Document

## Introduction

The Bubble Room is a fun, animated Q&A space inside the Henry Math Classroom platform. Students can post questions at any time — either while working on a challenge or as standalone questions. Both students and Henry (the teacher) can respond to any question. The room's signature experience is a floating-bubble animation: when a student opens the Bubble Room page, question bubbles rise from the bottom of the screen like soap bubbles. Students click a bubble to expand it and read or add responses. A weighted shuffle system ensures newer questions surface more often, and duplicate detection prevents redundant questions from being created.

---

## Glossary

- **Bubble_Room**: The animated Q&A page that houses all question bubbles for a class.
- **Question_Bubble**: A visual bubble element representing a single student question.
- **Question**: A text-based query posted by a student, optionally linked to a specific challenge.
- **Response**: A text reply posted by a student or Henry in reply to a Question.
- **Henry**: The teacher/owner of the Henry Math Classroom platform; has full moderation rights.
- **Student**: An authenticated user enrolled in a class with the student role.
- **Bubble_Animation_Engine**: The client-side system responsible for rendering and cycling Question_Bubbles on the Bubble Room page.
- **Duplicate_Detector**: The server-side (or edge) component that compares a new question's text against existing questions using keyword/semantic similarity.
- **Similarity_Score**: A numeric value (0.0–1.0) representing how closely a candidate question matches an existing question.
- **Weighted_Shuffle**: The ordering algorithm that gives newer questions a proportionally higher probability of appearing first in each animation cycle.
- **Cycle**: One full pass through all visible questions in the Bubble_Animation_Engine before questions repeat.
- **Class**: A named group of students taught by Henry, as defined in the existing platform schema.
- **Challenge**: An existing daily challenge entity in the platform; a Question may optionally reference one.

---

## Requirements

### Requirement 1: Post a Question

**User Story:** As a student, I want to post a question to the Bubble Room — either from within a challenge or as a standalone question — so that Henry or my classmates can help me.

#### Acceptance Criteria

1. WHEN a student submits a new question, THE Bubble_Room SHALL persist the question with the student's `user_id`, the `class_id`, an optional `challenge_id`, the question text (maximum 2000 characters), and a `created_at` timestamp.
2. THE Bubble_Room SHALL provide an "Ask a Question" button on the Bubble Room page and an inline "Ask About This Challenge" button on any challenge page that is currently assigned and not past its due date.
3. WHERE a question is submitted from a challenge page, THE Bubble_Room SHALL automatically associate the question with the corresponding `challenge_id`.
4. WHEN a student submits a question with an empty or whitespace-only text body, THE Bubble_Room SHALL reject the submission and display an inline validation error message without persisting any data.
5. WHEN a question is successfully created, THE Bubble_Room SHALL make it visible to all members of the same class within 5 seconds without requiring a page refresh.
6. WHEN a student who has no active enrollment in any class attempts to submit a question, THE Bubble_Room SHALL reject the submission and display an inline error message.

---

### Requirement 2: Duplicate Detection

**User Story:** As a student, I want the system to warn me if a similar question already exists before I post, so that I don't create duplicates and can find answers faster.

#### Acceptance Criteria

1. WHEN a student submits a new question, THE Duplicate_Detector SHALL compute a Similarity_Score between the new question text and each existing question in the same class using keyword overlap (Jaccard similarity on normalized tokens).
2. IF the Duplicate_Detector finds one or more existing questions with a Similarity_Score of 0.7 or above, THEN THE Bubble_Room SHALL pause the submission and display a list of up to 3 matching questions ordered by descending Similarity_Score, with a confirmation prompt asking whether the student still wants to create a new question.
3. WHEN a student selects "Yes, post anyway" on the confirmation prompt, THE Bubble_Room SHALL proceed to create the new question and dismiss the prompt.
4. WHEN a student selects "No, go back" on the confirmation prompt, THE Bubble_Room SHALL dismiss the prompt and return the student to the question composition form with their original text preserved.
5. IF the Duplicate_Detector finds no existing questions with a Similarity_Score of 0.7 or above, THEN THE Bubble_Room SHALL submit the question immediately without showing any confirmation prompt.
6. WHEN the Duplicate_Detector fails to compute similarity scores due to a service error, THE Bubble_Room SHALL proceed with question creation as if no duplicates were found and log the error silently.

---

### Requirement 3: View and Respond to Questions

**User Story:** As a student or Henry, I want to expand a question bubble and read its responses, so that I can learn from existing discussions.

#### Acceptance Criteria

1. WHEN a user clicks on a Question_Bubble, THE Bubble_Room SHALL expand the bubble into a detail view showing the full question text, the author's display name, the creation timestamp, and all associated Responses in chronological order.
2. THE Bubble_Room SHALL display each Response with the responder's display name, role indicator (student or Henry), and the response timestamp.
3. WHEN a student or Henry submits a response to a question that has not been deleted, THE Bubble_Room SHALL persist the response with the responder's `user_id`, the `question_id`, the response text (maximum 2000 characters), and a `created_at` timestamp.
4. WHEN a response is submitted with an empty or whitespace-only text body, THE Bubble_Room SHALL reject the submission and display an inline validation error message without persisting any data.
5. WHEN a new response is successfully submitted, THE Bubble_Room SHALL display it in the question detail view within 2 seconds without requiring a full page reload.
6. WHEN a response submission fails due to a network or server error, THE Bubble_Room SHALL display an inline error message, leave the response input text intact, and not persist any data.

---

### Requirement 4: Search Questions

**User Story:** As a student, I want to search existing questions by keyword, so that I can quickly find relevant discussions without scrolling through all bubbles.

#### Acceptance Criteria

1. THE Bubble_Room SHALL provide a search input field that accepts keyword queries of up to 200 characters.
2. WHEN a student enters a keyword query of 1 or more non-whitespace characters and pauses typing for 300 milliseconds, THE Bubble_Room SHALL display a filtered list of questions whose title or body text contains the keyword (case-insensitive).
3. WHEN a search query returns zero matches, THE Bubble_Room SHALL display a "No questions found" message and a button that opens the question composition form pre-populated with the search query text.
4. WHEN a student clears the search input field (empties it to zero characters), THE Bubble_Room SHALL return to the default animated bubble view and resume the Bubble_Animation_Engine.
5. WHILE a search query is active, THE Bubble_Animation_Engine SHALL pause the floating animation and display matching results as a static, scrollable list.
6. WHEN a search operation fails due to a network or server error, THE Bubble_Room SHALL display an inline error message and leave the search input intact.

---

### Requirement 5: Bubble Animation

**User Story:** As a student, I want to see question bubbles float up from the bottom of the screen when I visit the Bubble Room, so that the experience feels playful and inviting.

#### Acceptance Criteria

1. WHEN a student navigates to the Bubble Room page, THE Bubble_Animation_Engine SHALL begin rendering the first Question_Bubble rising from the bottom of the viewport within 1 second of page load completion.
2. THE Bubble_Animation_Engine SHALL apply the Weighted_Shuffle algorithm so that questions created within the past 48 hours have a 2× higher probability of appearing earlier in each Cycle than older questions.
3. WHEN a Cycle completes (all questions have been shown at least once), THE Bubble_Animation_Engine SHALL begin a new Cycle with a freshly computed Weighted_Shuffle ordering.
4. THE Bubble_Animation_Engine SHALL render each Question_Bubble with a randomized horizontal start position (0–100% viewport width), a randomized lateral drift offset (±5–15% viewport width), and a randomized rise speed within the range of 6–14 seconds per bubble so that bubbles appear natural rather than uniform.
5. THE Bubble_Animation_Engine SHALL maintain between 3 and 7 simultaneously visible Question_Bubbles on screen at any given time during active animation.
6. IF the Bubble Room has zero questions, THEN THE Bubble_Animation_Engine SHALL display an empty-state illustration with a clearly labeled call-to-action button to post the first question.
7. WHEN a student navigates away from the Bubble Room page, THE Bubble_Animation_Engine SHALL stop rendering bubbles and cease spawning new ones.

---

### Requirement 6: Question and Response Moderation by Henry

**User Story:** As Henry, I want to be able to delete any question or response that is off-topic or inappropriate, so that I can maintain a focused and safe learning environment.

#### Acceptance Criteria

1. WHEN Henry views a question detail, THE Bubble_Room SHALL display a "Delete Question" action that is visible and actionable only for users with the teacher/Henry role.
2. WHEN Henry confirms deletion of a question, THE Bubble_Room SHALL permanently remove the question and all of its associated Responses from the database and display a success message confirming the deletion.
3. WHEN Henry views a response in a question detail, THE Bubble_Room SHALL display a "Delete Response" action that is visible and actionable only for users with the teacher/Henry role.
4. WHEN Henry confirms deletion of a response, THE Bubble_Room SHALL permanently remove that Response from the question detail view and display a success message confirming the deletion.
5. IF a user without the teacher/Henry role attempts to delete a question or response authored by another user, THEN THE Bubble_Room SHALL display an authorization error message to that user and leave the question or response unchanged.
6. WHEN a student views a question or response they authored, THE Bubble_Room SHALL allow the student to delete only their own content under the rules defined in Requirement 7.

---

### Requirement 7: Student Self-Moderation

**User Story:** As a student, I want to be able to delete my own questions or responses if I change my mind, so that I have control over my contributions.

#### Acceptance Criteria

1. WHEN a student views a question they authored, THE Bubble_Room SHALL display a "Delete" action on that question; the Delete action SHALL be rendered only for the authenticated user whose identity matches the question's author.
2. WHEN a student selects Delete on their own question and confirms the action, THE Bubble_Room SHALL permanently remove the question and all Responses directly associated with it within 3 seconds and remove the corresponding bubble from the animation.
3. WHEN a student views a response they authored in a question detail, THE Bubble_Room SHALL display a "Delete" action on that response; the Delete action SHALL be rendered only for the authenticated user whose identity matches the response's author.
4. WHEN a student selects Delete on their own response and confirms the action, THE Bubble_Room SHALL permanently remove that Response from the question detail view within 3 seconds.
5. WHEN a student views a question or response authored by another user, THE Bubble_Room SHALL NOT display a Delete action for that content.
6. WHEN a deletion attempt fails due to a network or server error, THE Bubble_Room SHALL display an inline error message, dismiss the confirmation prompt, and leave the question or response unchanged.

---

### Requirement 8: Access Control and Data Isolation

**User Story:** As a class member, I want to see only questions from my own class, so that discussions remain relevant and private to my group.

#### Acceptance Criteria

1. THE Bubble_Room SHALL enforce Row Level Security (RLS) policies so that a student can only read questions and responses belonging to classes in which the student has an enrollment record with status 'active'; queries for other classes SHALL return an empty result set rather than an error.
2. WHEN an unauthenticated user attempts to access the Bubble Room, THE Bubble_Room SHALL redirect the user to the login page.
3. THE Bubble_Room SHALL enforce at the database level that a student can only INSERT questions into classes in which the student has an enrollment record with status 'active'; unauthorized INSERT attempts SHALL be rejected with an error.
4. THE Bubble_Room SHALL enforce at the database level that a student can only INSERT responses to questions that belong to a class in which the student has an enrollment record with status 'active'; unauthorized INSERT attempts SHALL be rejected with an error.
5. WHEN a question is linked to a `challenge_id`, THE Bubble_Room SHALL verify at INSERT time that the challenge's `class_id` matches the question's `class_id`; IF there is a mismatch, THEN THE Bubble_Room SHALL reject the INSERT and return an error to the client.
