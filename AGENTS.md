# AGENTS.md

## Project overview

OpenStudy Planner is a local-first, open-source study task planner designed initially for candidates preparing for Guangdong's “3+ Certificate” examination.

The MVP validates one core workflow:

> Create task → Select today's priorities → Start → Mark result → Replan unfinished tasks

## Required reading

Before proposing or making changes, read:

1. `README.md`
2. `docs/PRODUCT_SPEC.md`
3. `docs/INFORMATION_ARCHITECTURE.md`
4. `docs/DEVELOPMENT_TASKS.md`
5. `docs/DECISIONS.md`
6. `docs/STATUS.md`

If documents conflict, report the conflict before implementation.

## MVP scope rules

- Do not expand the MVP without explicit approval.
- Ordinary task creation must require only a task name.
- Subject, learning format, date, notes, next step, completion criteria, actual time, and actual result remain optional.
- One to three priority tasks are a recommendation, not a hard limit.
- Unfinished tasks must not be automatically moved to the next day.
- Users must decide whether to continue, reduce, split, postpone, return, or remove unfinished tasks.
- Local storage must not be described as absolutely secure or completely anonymous.

## Prohibited MVP features

Do not add:

- AI planning or AI task suggestions;
- Pomodoro timers or focus timers;
- user accounts or login;
- cloud synchronization;
- rankings, social features, or streaks;
- score or admission prediction;
- complex statistics or charts;
- automatic reminders or notifications;
- PWA installation;
- dark mode;
- printing;
- subject-specific complex forms;
- automatic task rollover.

## Privacy and security

- Do not upload task names, notes, next steps, completion criteria, or other task content during normal task operations.
- Do not add advertising, cross-site tracking, or unnecessary analytics.
- Treat user input as text and do not execute user-provided HTML or scripts.
- Do not commit real user data, backup files, API keys, credentials, or secrets.
- Use fictional information in examples and tests.
- Import failures must preserve the user's existing data.

## Working process

For each development task:

1. Read the relevant product documents.
2. State the exact task scope.
3. Do not modify unrelated features.
4. Run the available tests and production build.
5. Report failed or unexecuted checks honestly.
6. Update `docs/STATUS.md`.
7. Record important new decisions in `docs/DECISIONS.md`.

Do not claim that tests passed unless they were actually run.

## Current stage

DEV-001 through DEV-041 have been implemented and release-checked for the MVP.

The current release-preparation batch includes responsive and page-state fixes,
focused Vitest/DOM coverage, README and Pages workflow documentation, and the
final scope/privacy review. DEV-042 and DEV-043 remain out of this batch.

The next step is a human final review, followed by an intentional commit and
GitHub Pages configuration when the repository owner is ready to publish.
