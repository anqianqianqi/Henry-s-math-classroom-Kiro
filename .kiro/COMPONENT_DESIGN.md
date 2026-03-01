# Component Design Guidelines

## Philosophy: Build Reusable, Composable Components

Every component should be designed with reusability in mind. Before creating a new component, ask:
1. Can this be reused elsewhere?
2. Is this doing too many things? (Should it be split?)
3. Does a similar component already exist?

---

## Component Hierarchy

### Level 1: Base UI Components (Atoms)
**Purpose**: Smallest, most reusable building blocks

**Examples**:
- `Button` - Generic button with variants
- `Input` - Text input with validation
- `Card` - Container with consistent styling
- `Badge` - Status indicators
- `Avatar` - User profile pictures
- `Spinner` - Loading indicators

**Rules**:
- No business logic
- Highly configurable via props
- No direct API calls
- No state management (or minimal local state)
- Should work in any context

**Example**:
```tsx
// ✅ Good: Reusable, configurable
<Button variant="primary" size="lg" onClick={handleClick}>
  Submit
</Button>

// ❌ Bad: Too specific
<SubmitChallengeButton challengeId={123} />
```

---

### Level 2: Composite Components (Molecules)
**Purpose**: Combine base components into functional units

**Examples**:
- `FormField` - Label + Input + Error message
- `SearchBar` - Input + Search icon + Clear button
- `UserCard` - Avatar + Name + Role badge
- `DatePicker` - Input + Calendar dropdown

**Rules**:
- Combine 2-3 base components
- Handle local UI state (open/closed, focused, etc.)
- Still reusable across features
- Minimal business logic

**Example**:
```tsx
// ✅ Good: Reusable form field
<FormField
  label="Challenge Title"
  value={title}
  onChange={setTitle}
  error={errors.title}
/>

// ❌ Bad: Too specific to one feature
<ChallengeTitleField challengeId={123} />
```

---

### Level 3: Feature Components (Organisms)
**Purpose**: Feature-specific components with business logic

**Examples**:
- `DailyChallengeCard` - Display a challenge with submit button
- `ClassMemberList` - List of class members with roles
- `SubmissionFeed` - Display all submissions with filters
- `ChallengeForm` - Form to create/edit challenges

**Rules**:
- Can contain business logic
- Can make API calls
- Can use state management
- Composed of base and composite components
- Still reusable within the feature domain

**Example**:
```tsx
// ✅ Good: Feature component using base components
function DailyChallengeCard({ challenge }) {
  const { submit, isLoading } = useSubmitChallenge();
  
  return (
    <Card>
      <Heading>{challenge.title}</Heading>
      <Text>{challenge.description}</Text>
      <Button 
        onClick={() => submit(challenge.id)}
        isLoading={isLoading}
      >
        Submit Response
      </Button>
    </Card>
  );
}
```

---

### Level 4: Page Components (Templates)
**Purpose**: Full page layouts

**Examples**:
- `DailyChallengePage` - Complete daily challenge view
- `ClassDashboard` - Teacher's class management page
- `StudentHomePage` - Student's home view

**Rules**:
- Compose feature components
- Handle page-level state
- Handle routing
- Fetch page-level data

---

## Component Design Patterns

### Pattern 1: Compound Components
**Use when**: Components work together as a unit

```tsx
// ✅ Good: Flexible, composable
<Card>
  <Card.Header>
    <Card.Title>Daily Challenge</Card.Title>
  </Card.Header>
  <Card.Body>
    <Text>Challenge description...</Text>
  </Card.Body>
  <Card.Footer>
    <Button>Submit</Button>
  </Card.Footer>
</Card>
```

### Pattern 2: Render Props / Children
**Use when**: Need to customize rendering

```tsx
// ✅ Good: Flexible content
<Modal isOpen={isOpen} onClose={handleClose}>
  <h2>Confirm Submission</h2>
  <p>Are you sure?</p>
  <Button onClick={handleConfirm}>Yes</Button>
</Modal>
```

### Pattern 3: Custom Hooks for Logic Reuse
**Use when**: Same logic needed in multiple components

```tsx
// ✅ Good: Reusable logic
function usePermission(permission: string, classId?: string) {
  const { user } = useAuth();
  return checkPermission(user, permission, classId);
}

// Use in multiple components
function CreateChallengeButton() {
  const canCreate = usePermission('challenge:create');
  if (!canCreate) return null;
  return <Button>Create Challenge</Button>;
}
```

---

## Reusability Checklist

Before creating a component, check:

- [ ] Does a similar component already exist?
- [ ] Can I make an existing component more flexible instead?
- [ ] Is this component doing ONE thing well?
- [ ] Can this be used in multiple places?
- [ ] Are props clearly named and typed?
- [ ] Is the component testable?
- [ ] Does it have sensible defaults?
- [ ] Is it documented (JSDoc comments)?

---

## Anti-Patterns to Avoid

### ❌ Overly Specific Components
```tsx
// Bad: Only works for one specific case
function SubmitMathChallenge123Button() {
  return <button onClick={() => submitChallenge(123)}>Submit</button>;
}

// Good: Reusable
function SubmitButton({ onSubmit, children }) {
  return <button onClick={onSubmit}>{children}</button>;
}
```

### ❌ God Components (Do Everything)
```tsx
// Bad: Does too many things
function DailyChallengePage() {
  // 500 lines of code
  // Handles auth, data fetching, form validation, submission, display, etc.
}

// Good: Split into focused components
function DailyChallengePage() {
  return (
    <PageLayout>
      <ChallengeHeader />
      <ChallengeContent />
      <SubmissionForm />
      <SubmissionList />
    </PageLayout>
  );
}
```

### ❌ Prop Drilling Hell
```tsx
// Bad: Passing props through many levels
<Page user={user}>
  <Layout user={user}>
    <Sidebar user={user}>
      <UserMenu user={user} />
    </Sidebar>
  </Layout>
</Page>

// Good: Use context or state management
const { user } = useAuth(); // Available anywhere
```

### ❌ Duplicate Code
```tsx
// Bad: Same code in multiple places
function TeacherButton() {
  return <button className="bg-blue-500 px-4 py-2 rounded">Click</button>;
}
function StudentButton() {
  return <button className="bg-blue-500 px-4 py-2 rounded">Click</button>;
}

// Good: Reuse base component
function Button({ children, ...props }) {
  return <button className="bg-blue-500 px-4 py-2 rounded" {...props}>{children}</button>;
}
```

---

## Component Documentation

Every reusable component should have JSDoc comments:

```tsx
/**
 * A reusable button component with multiple variants and sizes.
 * 
 * @example
 * <Button variant="primary" size="lg" onClick={handleClick}>
 *   Submit
 * </Button>
 * 
 * @param variant - Button style: 'primary' | 'secondary' | 'danger'
 * @param size - Button size: 'sm' | 'md' | 'lg'
 * @param isLoading - Shows loading spinner when true
 * @param disabled - Disables the button
 * @param onClick - Click handler
 * @param children - Button content
 */
export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  onClick,
  children,
}: ButtonProps) {
  // Implementation
}
```

---

## Testing Reusable Components

Reusable components MUST have tests:

```tsx
// Button.test.tsx
describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows loading state', () => {
    render(<Button isLoading>Submit</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });
});
```

---

## Summary: Think Before You Code

1. **Can I reuse an existing component?** → Check `/components/ui` first
2. **Is this too specific?** → Make it more generic
3. **Is this doing too much?** → Split into smaller components
4. **Will I need this elsewhere?** → Design for reusability
5. **Is it easy to understand?** → Add comments and examples

**Remember**: Writing reusable components takes slightly more time upfront but saves massive time later!
