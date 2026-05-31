# Requirements Document

## Introduction

The Engaging Virtual Pet feature redesigns the daily engagement layer of Henry Math Classroom's existing virtual pet system. The base pet system (species, XP, evolution stages, accessories, feeding) is already implemented. This feature adds the psychological hooks that make virtual pets genuinely compelling — daily check-in rituals, emotional attachment mechanics, happiness/hunger decay, streak rewards, surprise moments, milestone celebrations, and lightweight social elements — to drive students aged 8–16 to log in every day and grow with their pet.

The design draws on proven engagement patterns from Tamagotchi (urgency through neglect decay), Neopets (daily activities and social sharing), and Pokémon (milestone celebrations and collection goals). Every mechanic is tied to academic activity so that engagement with the pet reinforces engagement with math.

---

## Glossary

- **Pet**: The existing virtual companion in `student_pets`, with species, XP, evolution stage, and accessories.
- **Happiness**: A numeric score (0–100) representing the pet's current emotional state, stored in `student_pets`. Decays over time when the student is absent.
- **Hunger**: A numeric score (0–100) representing how recently the pet has been fed, stored in `student_pets`. Decays over time when no food items are redeemed.
- **Mood**: The combined visible state derived from Happiness and Hunger, expressed as one of: `thriving`, `happy`, `neutral`, `sad`, `neglected`.
- **Daily_Login_Bonus**: A fixed point reward granted once per calendar day when a student visits any page while authenticated.
- **Daily_Challenge_Bonus**: An additional point reward granted when a student completes at least one math challenge on a given calendar day.
- **Streak**: The count of consecutive calendar days on which a student has earned a Daily_Login_Bonus.
- **Streak_Milestone**: A Streak length that triggers a special reward: 3, 7, 14, 30, 60, 100 days.
- **Mood_Animation**: A variant of the pet's idle SVG animation that reflects the current Mood (e.g., drooping ears for `sad`, sparkle eyes for `thriving`).
- **Neglect_Warning**: A UI indicator shown when the pet's Mood is `sad` or `neglected`, prompting the student to return.
- **Surprise_Event**: A randomly triggered special moment (once per week per student) that presents the pet doing something unexpected — finding a treasure, learning a trick, or sending a message — rewarding the student with bonus points or a rare accessory.
- **Milestone_Celebration**: A full-screen animated moment triggered when the pet reaches a new Evolution_Stage or a Streak_Milestone.
- **Pet_Mood_Card**: A compact widget on the student Dashboard showing the pet's current Mood, Hunger level, and a call-to-action.
- **Classroom_Wall**: A read-only social feed on the class page showing recent pet milestones from classmates (evolution events, streak milestones).
- **Pet_Nameplate**: A student-assigned name for their pet, displayed on the Pet_Page and in the Classroom_Wall.
- **Mood_Decay_Job**: A scheduled server-side process that reduces Happiness and Hunger over time for all pets.
- **Login_Bonus_Job**: A server-side function that records the Daily_Login_Bonus and updates the Streak when a student authenticates.
- **Student**: A user with the `student` role.
- **Teacher**: A user with the `teacher` or `administrator` role.
- **Pet_Page**: The existing page at `/pet`.
- **Dashboard**: The existing student dashboard page.
- **Desktop_Pet_Widget**: The floating fixed-position pet companion visible on every page. Shows the student's own pet for authenticated students; shows Didi for teachers/unauthenticated users.
- **Quick-Action_Popover**: An inline overlay that opens when the student clicks the Desktop_Pet_Widget, showing mood, streak, and quick links without navigating away.

---

## Requirements

### Requirement 1: Pet Happiness and Hunger System

**User Story:** As a student, I want my pet to have visible emotional needs that change over time, so that I feel a genuine connection and responsibility toward it.

#### Acceptance Criteria

1. THE Pet_System SHALL add `happiness` (INTEGER, 0–100, default 80) and `hunger` (INTEGER, 0–100, default 80) columns to the `student_pets` table.
2. THE Pet_System SHALL define Mood as a derived value computed from Happiness and Hunger according to this mapping: `thriving` when both ≥ 80, `happy` when both ≥ 60, `neutral` when both ≥ 40, `sad` when either < 40, `neglected` when either < 20.
3. WHEN a student visits the Pet_Page, THE Pet_Page SHALL display the pet's current Mood as a visible label and apply the corresponding Mood_Animation to the SVG pet.
4. THE Mood_Decay_Job SHALL reduce Happiness by 10 points and Hunger by 15 points for every 24-hour period in which the student has not logged in, with a minimum floor of 0 for both values.
5. WHEN a student redeems a food item, THE Pet_System SHALL increase Hunger by the item's `food_xp` value divided by 5 (rounded down), capped at 100.
6. WHEN a student earns a Daily_Login_Bonus, THE Pet_System SHALL increase Happiness by 10 points, capped at 100.
7. WHEN a student completes a math challenge, THE Pet_System SHALL increase both Happiness and Hunger by 5 points each, capped at 100.
8. IF a pet's Mood is `neglected` for 3 or more consecutive days, THEN THE Pet_Page SHALL display a Neglect_Warning banner with the message "Your pet misses you! Log in daily to keep it happy."
9. THE Pet_Page SHALL display Happiness and Hunger as two separate progress bars with numeric labels, positioned below the XP bar.

---

### Requirement 2: Daily Login Bonus and Streak System

**User Story:** As a student, I want to be rewarded for logging in every day, so that I have a reason to check on my pet even on days when I don't have homework.

#### Acceptance Criteria

1. WHEN an authenticated student loads any page for the first time on a given calendar day (UTC), THE Login_Bonus_Job SHALL record a `daily_login_events` row for that student and that date, granting 5 points to the student's wallet.
2. THE Login_Bonus_Job SHALL grant the Daily_Login_Bonus at most once per student per calendar day; subsequent page loads on the same day SHALL NOT grant additional points.
3. THE Pet_System SHALL maintain a `current_streak` INTEGER column and a `last_login_date` DATE column on `student_pets`, updated by the Login_Bonus_Job each time a Daily_Login_Bonus is granted.
4. WHEN a student earns a Daily_Login_Bonus on a date that is exactly one calendar day after `last_login_date`, THE Pet_System SHALL increment `current_streak` by 1.
5. WHEN a student earns a Daily_Login_Bonus on a date that is more than one calendar day after `last_login_date`, THE Pet_System SHALL reset `current_streak` to 1.
6. THE Pet_Page SHALL display the student's current Streak as a flame icon with a numeric count (e.g., "🔥 7 days").
7. THE Dashboard SHALL display the student's current Streak in the Pet_Mood_Card.
8. WHEN a student's Streak reaches a Streak_Milestone (3, 7, 14, 30, 60, or 100 days), THE Pet_System SHALL trigger a Milestone_Celebration and grant a bonus reward: 3 days → 15 pts, 7 days → 40 pts, 14 days → 100 pts, 30 days → 250 pts, 60 days → 600 pts, 100 days → 1200 pts.
9. IF a student's `current_streak` is 0 and they have not logged in for more than 1 calendar day, THEN THE Pet_Mood_Card SHALL display a "Come back!" prompt with the message "Your streak is at risk — log in today!"

---

### Requirement 3: Daily Challenge Bonus

**User Story:** As a student, I want completing math challenges to directly benefit my pet, so that academic effort feels immediately rewarding.

#### Acceptance Criteria

1. WHEN a student submits a correct answer to a math challenge for the first time on a given calendar day, THE Pet_System SHALL grant a Daily_Challenge_Bonus of 10 points to the student's wallet.
2. THE Pet_System SHALL grant the Daily_Challenge_Bonus at most once per student per calendar day; additional correct submissions on the same day SHALL NOT grant additional Daily_Challenge_Bonus points (though they still earn the challenge's normal point reward).
3. WHEN a student earns a Daily_Challenge_Bonus, THE Pet_Page SHALL display a transient banner: "🧮 Math bonus! Your pet gained +5 Happiness and +5 Hunger."
4. THE Pet_Page SHALL display a "Daily Challenge" call-to-action button linking to `/challenges` when the student has not yet earned the Daily_Challenge_Bonus for the current day.
5. WHEN a student has already earned the Daily_Challenge_Bonus for the current day, THE Pet_Page SHALL replace the call-to-action button with a checkmark indicator: "✅ Math done for today!" — this indicator SHALL only appear when the bonus has actually been earned.

---

### Requirement 4: Milestone Celebrations

**User Story:** As a student, I want big moments — like my pet evolving or hitting a streak milestone — to feel genuinely exciting, so that I look forward to reaching the next goal.

#### Acceptance Criteria

1. WHEN a pet advances to a new Evolution_Stage, THE Pet_Page SHALL display a full-screen Milestone_Celebration overlay for 3 seconds before automatically dismissing, showing the new stage name, the pet's SVG at the new stage, and a congratulatory message.
2. WHEN a student reaches a Streak_Milestone, THE Pet_Page or Dashboard SHALL display a full-screen Milestone_Celebration overlay for 3 seconds, showing the streak count, a flame animation, and the bonus points earned.
3. THE Milestone_Celebration overlay SHALL include a "Share with class" button that, when tapped, posts the milestone to the Classroom_Wall.
4. THE Milestone_Celebration overlay SHALL be dismissible by tapping anywhere outside the overlay or pressing Escape, before the 3-second auto-dismiss.
5. WHEN a pet reaches `legendary` evolution stage, THE Milestone_Celebration SHALL display a unique "Legendary!" animation distinct from other evolution celebrations, using a gold color palette and a 5-second display duration.
6. THE Pet_System SHALL record each Milestone_Celebration in a `pet_milestones` table with columns: `id`, `user_id`, `milestone_type` (TEXT: `evolution` or `streak`), `milestone_value` (TEXT: stage name or streak count), `celebrated_at` (TIMESTAMPTZ), `shared_to_wall` (BOOLEAN, default false).

---

### Requirement 5: Surprise Events

**User Story:** As a student, I want occasional unexpected moments with my pet, so that logging in always has the potential for something delightful.

#### Acceptance Criteria

1. THE Pet_System SHALL generate at most one Surprise_Event per student per 7-day rolling window, triggered when the student visits the Pet_Page and a random probability check passes (20% chance per visit, evaluated at most once per day per student).
2. THE Pet_System SHALL define at least 5 distinct Surprise_Event types: `treasure_found` (pet found a hidden item worth 10–30 bonus points), `new_trick` (pet learned a trick, displayed as a unique one-time animation), `love_letter` (pet sends a short encouraging message about math), `mystery_egg` (a small decorative egg accessory is added to the student's inventory), `double_xp` (next food item fed grants double XP).
3. WHEN a Surprise_Event is triggered, THE Pet_Page SHALL display a modal with the event's illustration, description, and reward before the student can dismiss it.
4. THE Pet_System SHALL record each Surprise_Event in a `pet_surprise_events` table with columns: `id`, `user_id`, `event_type` (TEXT), `reward_value` (INTEGER, nullable), `triggered_at` (TIMESTAMPTZ), `dismissed_at` (TIMESTAMPTZ, nullable).
5. IF a student has not visited the Pet_Page in 3 or more days and then returns, THEN THE Pet_System SHALL guarantee a Surprise_Event on that return visit, overriding both the 20% probability check and the 7-day rate limit.
6. THE Surprise_Event modal SHALL be dismissible only by an explicit tap on a "Claim reward" button, not by tapping outside the modal, to ensure the student sees the reward.

---

### Requirement 6: Pet Naming

**User Story:** As a student, I want to give my pet a name, so that I feel a personal connection to it.

#### Acceptance Criteria

1. THE Pet_System SHALL add a `pet_name` column (TEXT, nullable, maximum 20 characters) to the `student_pets` table.
2. WHEN a student selects a species for the first time (hatching from egg), THE Pet_Page SHALL display a name input field immediately after species selection, before showing the evolved pet.
3. THE Pet_Page SHALL accept a pet name of 1–20 characters containing only letters, numbers, spaces, and hyphens; IF the student submits a name outside these constraints, THE Pet_Page SHALL display an inline validation error and SHALL NOT save the name.
4. WHEN a student saves a valid pet name, THE Pet_Page SHALL display the name as a styled nameplate above the SVG pet on the Pet_Page.
5. THE Pet_Page SHALL allow the student to rename their pet at any time via an edit icon next to the nameplate, subject to the same validation rules.
6. WHEN a student has not yet named their pet (null `pet_name`), THE Pet_Page SHALL display "Unnamed Pet" as a placeholder nameplate with a prompt to add a name.

---

### Requirement 7: Classroom Wall (Social Feed)

**User Story:** As a student, I want to see my classmates' pet milestones, so that I feel part of a community and am motivated by their progress.

#### Acceptance Criteria

1. THE Classroom_Wall SHALL be a read-only feed displayed on the class detail page (`/classes/[id]`) showing the 20 most recent pet milestone events shared by students enrolled in that class.
2. WHEN a student shares a milestone to the Classroom_Wall, THE Pet_System SHALL insert a row into `classroom_wall_posts` with columns: `id`, `class_id`, `user_id`, `milestone_type`, `milestone_value`, `pet_name` (snapshot), `pet_species` (snapshot), `pet_stage` (snapshot), `posted_at` (TIMESTAMPTZ).
3. THE Classroom_Wall SHALL display each post with: the student's first name, the pet's name and species, a thumbnail of the pet's SVG at the relevant stage, and a human-readable description (e.g., "Alex's Dragon 'Blaze' evolved to Adult! 🎉").
4. THE Classroom_Wall SHALL be visible to all students enrolled in the class and to the class teacher; students not enrolled in the class SHALL NOT see the Classroom_Wall.
5. THE Classroom_Wall SHALL update in real-time using Supabase Realtime subscriptions so that new posts appear without a page reload.
6. THE Classroom_Wall SHALL NOT display the student's full name or any personally identifiable information beyond their first name and pet details.
7. WHEN a class has no shared milestones yet, THE Classroom_Wall SHALL display an empty-state message: "No milestones shared yet — be the first!"

---

### Requirement 8: Pet Mood Card on Dashboard

**User Story:** As a student, I want to see my pet's current mood on the dashboard, so that I am immediately aware when my pet needs attention without having to navigate to the pet page.

#### Acceptance Criteria

1. THE Dashboard SHALL replace the existing Pet_Preview_Card with an enhanced Pet_Mood_Card that displays: the pet's SVG thumbnail with Mood_Animation, the pet's name, the current Mood label, Hunger and Happiness as compact progress indicators, the current Streak with flame icon, and a "Visit Pet" button linking to `/pet`.
2. WHEN the pet's Mood is `sad` or `neglected`, THE Pet_Mood_Card SHALL use a visually distinct warning style with an amber or red border to draw the student's attention.
3. WHEN the pet's Mood is `thriving`, THE Pet_Mood_Card SHALL use a celebratory style (gold border, sparkle icon) to reinforce positive behavior.
4. THE Pet_Mood_Card SHALL display whether the student has already earned the Daily_Login_Bonus and Daily_Challenge_Bonus for the current day, using checkmark or pending indicators.
5. THE Pet_Mood_Card SHALL load its data in a single combined query with the rest of the Dashboard, adding no additional database round-trips.

---

### Requirement 9: In-App Notification for Pet Needs

**User Story:** As a student, I want to receive in-app notifications when my pet is unhappy or hungry, so that I am reminded to log in even when I forget.

#### Acceptance Criteria

1. WHEN a student loads any authenticated page and their pet's Mood is `sad` or `neglected`, THE Notification_System SHALL display a persistent in-app banner at the top of the page with the message "Your pet [name] is [mood] — visit the pet page to cheer it up!" and a link to `/pet`.
2. THE Notification_System SHALL display the pet mood banner only when it has not yet been shown in the current browser session, to avoid being intrusive.
3. WHEN a student dismisses the pet mood banner, THE Notification_System SHALL NOT show it again for the remainder of that browser session.
4. THE Notification_System SHALL integrate with the existing notifications system (the `notifications` table) to record a `pet_mood_alert` notification when a pet's Mood transitions to `sad` or `neglected`, so that the student can see it in their notification inbox.
5. THE Notification_System SHALL NOT send email notifications for pet mood alerts; pet mood alerts are in-app only.

---

### Requirement 10: Teacher Engagement Dashboard

**User Story:** As a teacher, I want to see which students are actively engaging with their pets and which are falling behind, so that I can use pet engagement as a proxy for daily login behavior.

#### Acceptance Criteria

1. THE Teacher_Pet_Overview SHALL be enhanced to display, for each student: the pet's name, species, evolution stage, current Mood, current Streak, and the date of the student's last login.
2. WHILE the Teacher_Pet_Overview is displayed, THE Teacher_Pet_Overview SHALL visually highlight students whose pet Mood is `sad` or `neglected` with a warning icon so the teacher can identify disengaged students at a glance.
3. THE Teacher_Pet_Overview SHALL be sortable by: student name (alphabetical), evolution stage (ascending/descending), current streak (descending), and last login date (most recent first).
4. THE Teacher_Pet_Overview SHALL be read-only; teachers SHALL NOT be able to modify student pet data from this view.
5. WHEN a class has no enrolled students with pets, THE Teacher_Pet_Overview SHALL display an empty-state message: "No students have pets yet."

---

### Requirement 11: Streak Freeze (Grace Mechanic)

**User Story:** As a student, I want a way to protect my streak when I genuinely can't log in, so that a single missed day doesn't undo weeks of effort.

#### Acceptance Criteria

1. THE Pet_System SHALL introduce a `streak_freezes` INTEGER column (default 0, minimum 0, maximum 3) on `student_pets`, representing the number of Streak_Freeze tokens the student holds.
2. WHEN a student's Streak would be reset due to a missed day, THE Pet_System SHALL automatically consume one Streak_Freeze token (if available) and preserve the current Streak instead of resetting it.
3. WHEN a Streak_Freeze is consumed, THE Pet_Page SHALL display a notification: "❄️ Streak Freeze used! Your streak of [N] days is safe."
4. THE Pet_System SHALL grant one Streak_Freeze token when a student reaches a Streak_Milestone of 7, 14, or 30 days (in addition to the point bonus), up to the maximum of 3.
5. THE Pet_Page SHALL display the student's current Streak_Freeze count as an ice crystal icon with a numeric count (e.g., "❄️ 2 freezes").
6. IF a student has 0 Streak_Freeze tokens and misses a day, THEN THE Pet_System SHALL reset `current_streak` to 1 on the next login, as specified in Requirement 2.5.

---

### Requirement 12: Pet Evolution Preview

**User Story:** As a student, I want to see what my pet will look like at the next evolution stage, so that I am motivated to keep earning XP.

#### Acceptance Criteria

1. WHILE the pet is not at `legendary` stage, THE Pet_Page SHALL display a "Next Stage Preview" section below the XP bar, showing a silhouetted version of the pet's SVG at the next Evolution_Stage rendered with CSS `grayscale(100%) opacity(30%)` filters applied to the SVG element.
2. WHEN the pet is at `legendary` stage, THE Pet_Page SHALL replace the Next Stage Preview with a "Max Stage Reached" badge and a total XP display.
3. WHILE the Next Stage Preview is displayed, THE Pet_Page SHALL show a label with the correctly calculated XP remaining to reach the next stage (e.g., "85 XP to Teen"), computed as `nextThreshold - currentXp`.
4. WHILE the Next Stage Preview is displayed, THE Pet_Page SHALL apply CSS `grayscale(100%) opacity(30%)` filters to the silhouette SVG to prevent revealing the full-color artwork of the next stage.
5. WHEN the student hovers over or taps the Next Stage Preview, THE Pet_Page SHALL display a tooltip: "Keep feeding your pet to unlock this stage!"

---

### Requirement 13: Ambient Desktop Pet (Always-On Companion)

**User Story:** As a student, I want my own pet to be visible on every page of the site — not just the pet page — so that I always feel its presence and am reminded to care for it while I do my schoolwork.

#### Acceptance Criteria

1. WHEN a student is authenticated and has a pet with a species selected (not egg stage), THE Desktop_Pet_Widget SHALL render the student's own pet SVG (dragon, fox, or cat at the correct evolution stage) as a floating fixed-position widget in the bottom-right corner of every page, replacing the Didi desktop pet for that student.

2. WHEN a student is authenticated but their pet is still in the `egg` stage (no species selected), THE Desktop_Pet_Widget SHALL render a floating egg SVG instead of a species illustration, with a speech bubble prompt: "Tap to hatch me!" that links to `/pet`.

3. WHEN a student is NOT authenticated, OR the user is a teacher or administrator, THE Desktop_Pet_Widget SHALL render Didi (the Ragdoll cat mascot) as the floating desktop pet, as it does today.

4. THE Desktop_Pet_Widget SHALL reflect the pet's current Mood through its animation:
   - `thriving`: bouncy idle animation with sparkle particles
   - `happy`: standard idle float animation (current default)
   - `neutral`: slow, calm idle animation
   - `sad`: drooping animation — pet sits with head down, slow breathing
   - `neglected`: grey-tinted, barely moving, occasional sad expression

5. WHEN a student clicks or taps the Desktop_Pet_Widget, THE Desktop_Pet_Widget SHALL open an inline **Quick-Action Popover** anchored above the pet without navigating away from the current page. The popover SHALL display:
   - The pet's name and current Mood label
   - Happiness and Hunger as compact progress bars
   - Current streak (🔥 N days)
   - A "Visit Pet" button linking to `/pet`
   - A "Do today's challenge" button linking to `/challenges` (shown only if Daily_Challenge_Bonus not yet earned today)
   - A "✅ Math done!" indicator (shown only if Daily_Challenge_Bonus already earned today)

6. WHEN the Quick-Action Popover is open and the student clicks anywhere outside it, THE popover SHALL close without navigating.

7. THE Desktop_Pet_Widget SHALL load the student's pet data (species, stage, mood, happiness, hunger, streak, daily bonus status) in a single lightweight API call on initial page load, cached in React context so subsequent page navigations within the same session do not re-fetch unless the data is stale (older than 60 seconds).

8. THE Desktop_Pet_Widget SHALL display the pet's name as a small nameplate label below the pet SVG, matching the Didi "Didi 🐾" label style.

9. WHEN the pet's Mood is `sad` or `neglected`, THE Desktop_Pet_Widget SHALL display a small pulsing red dot badge on the pet to draw attention, in addition to the mood animation change.

10. THE Desktop_Pet_Widget SHALL support the same drag-to-move, hover-to-resize, and minimize behaviors that Didi currently supports, so students can reposition their pet to avoid blocking content.

11. WHEN a student is on the `/pet` page, THE Desktop_Pet_Widget SHALL be hidden (display: none) to avoid showing the pet twice on the same page.

12. THE Desktop_Pet_Widget SHALL NOT make any database writes on its own; all state changes (feeding, mood updates) happen through the existing `/pet` page or API routes, and the widget reflects the cached state.
