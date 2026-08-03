# MVP v0.1 Release Checklist

Checked on 2026-08-03. This record covers DEV-030 through DEV-041 only; it
does not mark DEV-042 or DEV-043 as completed.

## Scope and privacy review

- [x] Primary navigation contains only 今日、任务库、数据与说明.
- [x] A normal task requires only a name; other MVP task fields remain optional.
- [x] One to three priorities is a recommendation, and a fourth task can still be added.
- [x] Unfinished tasks are never automatically moved to another day.
- [x] All six user-chosen replan operations are present; postponement is not a task status.
- [x] Imports validate first, then completely replace rather than merge; a failed import preserves old data.
- [x] Clear removes only the application storage key after confirmation.
- [x] Normal source code has no network interface that could upload task names, notes, next steps, or completion criteria.
- [x] No account, cloud sync, AI, timer, statistics, streak, ranking, notification, PWA, dark-mode, or print entry is present.
- [x] README and in-product text describe the implemented local-first scope and its limits.
- [x] Tracked files contain no real user data, backup, API key, or credential pattern.

## Responsive and state review

- [x] A 360px browser check verified no horizontal scrolling, text-labelled primary actions, visible mobile navigation, all six replan controls, and a cancellable confirmation dialog.
- [x] A 1280px browser check verified the desktop layout and the same navigation and task-creation path.
- [x] A form value remained present after changing the viewport.
- [x] Empty states cover no tasks, no priority, all-completed tasks, empty library, empty filter, empty removed list, no export data, no clear data, and no replan candidates.
- [x] Read, save, export, import, and clear failures communicate that the action did not succeed and whether existing data remains; dangerous actions can be cancelled.

## Automated checks

- [x] Lint completed successfully.
- [x] Vitest completed successfully: 6 files and 92 tests passed.
- [x] Production build completed successfully.
- [x] `git diff --check` completed successfully.

## Manual deployment prerequisite

Before the first public deployment, open **Settings → Pages** in the GitHub
repository and select **GitHub Actions** as the build and deployment source.
The workflow then deploys only after `npm ci`, lint, test, and build succeed.
