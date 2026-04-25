
## Core Dimensions

Score user answers across 5 dimensions:

| Dimension                 | What it checks                                            | Score |
| ------------------------- | --------------------------------------------------------- | ----- |
| Goal Understanding        | Does user know what the phase is trying to achieve?       | 0–2   |
| File Ownership            | Does user identify correct files/modules?                 | 0–3   |
| Responsibility Separation | Does user understand what each file should do?            | 0–3   |
| Data / Control Flow       | Does user explain how execution moves through the system? | 0–3   |
| Verification Plan         | Does user know how to test/check the change?              | 0–2   |

Total: **13 points**

---

# Passing Rules

## Guided Mode

Guided mode should be forgiving.

```txt
Pass if score >= 6/13
OR user gives a reasonable architecture-level explanation.
```

If weak:

```txt
Give correction + continue after light confirmation.
```

If user says:

```txt
"just do it"
```

Proceed.

---

## Socratic Mode

Socratic mode should be stricter.

```txt
Pass if score >= 10/13
AND File Ownership >= 2
AND Responsibility Separation >= 2
AND Verification Plan >= 1
```

If below threshold:

```txt
Block execution.
Give comparison:
- Your answer
- Stronger answer
- Why it matters
Then ask user to approve or retry.
```

---

# Scoring Details

## 1. Goal Understanding

```txt
0 = does not understand task
1 = vague but directionally correct
2 = clearly explains the phase goal
```

Example:

```txt
Good:
"This phase sets up auth routes and separates request handling from business logic."

Weak:
"It adds login stuff."
```

---

## 2. File Ownership

```txt
0 = wrong/no files mentioned
1 = mentions some files but unclear ownership
2 = mostly correct files
3 = correct files + why each matters
```

Example:

```txt
Good:
"auth.controller handles HTTP requests, auth.service handles login logic, auth.middleware protects routes."

Weak:
"controller does everything."
```

---

## 3. Responsibility Separation

```txt
0 = everything mixed together
1 = partial separation
2 = mostly correct separation
3 = clean separation with reasoning
```

Good answer should avoid:

```txt
Put validation, DB logic, token generation, and responses all in one controller.
```

---

## 4. Data / Control Flow

```txt
0 = no flow explained
1 = vague flow
2 = mostly correct flow
3 = clear step-by-step flow
```

Example:

```txt
Request → route → controller → service → database → response
```

---

## 5. Verification Plan

```txt
0 = no verification
1 = basic/manual check
2 = focused verification with expected result
```

Example:

```txt
Good:
"Call POST /login with valid credentials, expect token. Invalid password should return 401."

Weak:
"Run the app and see."
```

---

# Answer Classification

## Strong Answer

```txt
score >= 10
```

Proceed in Socratic mode.

## Partial Answer

```txt
score 6–9
```

Give corrected explanation and ask for approval.

## Weak Answer

```txt
score < 6
```

Do not proceed. Give hints first.

---

# Socratic Feedback Template

```md
Your answer is partially correct.

Score: 7/13

What you understood:
- You identified the controller.
- You know the route starts the flow.

What is missing:
- Token generation belongs in the service, not the controller.
- Middleware should protect private routes.
- Verification needs expected outcomes.

Stronger answer:
The request enters the route, reaches the controller, then the controller calls the auth service. The service checks the user and creates the token. Middleware verifies the token on protected routes. I would verify this with valid login, invalid login, and protected route tests.

Before I continue, confirm:
Do you agree with this architecture and want me to execute Phase 1?
```

---

# “Just Do It” Handling

## Guided Mode

```txt
User says: just do it
Action: proceed using best-practice defaults
```

## Socratic Mode

```txt
User says: just do it
Action: block politely
```

Response:

```md
I can’t skip the understanding check in Socratic mode.

For this phase, you need to confirm:
1. Which file owns the main logic?
2. Which file handles input/output?
3. How should we verify it?

Here is the best answer for comparison:
...
Reply with “approved” once you understand.
```

---

# Best Practical Heuristic

Use this simple rule:

```txt
Socratic mode should not require perfect answers.
It should require enough understanding to prevent blind approval.
```

So the agent should accept:

```txt
- imperfect wording
- non-technical language
- partial but correct mental model
```

But reject:

```txt
- “controller does everything”
- “I don’t know, continue”
- no file ownership
- no verification path
```
