# OpenStudy Planner Project Status

## Current phase

DEV-030 through DEV-041 final release-preparation batch completed; awaiting
human final review and the repository owner's GitHub Pages setting.

## Completed

- Created the public GitHub repository.
- Added the MIT License.
- Added the MVP product specification.
- Added the information architecture and low-fidelity page descriptions.
- Added the MVP development task list.
- Completed the first documentation consistency review.
- Prepared repository instructions, initial decisions, and project status files.
- Confirmed the MVP technical foundation: React, TypeScript, Vite, npm, native
  CSS, Vitest, and GitHub Pages as the deployment target.
- Initialized the React + TypeScript + Vite project foundation.
- Added the application entry point, placeholder page, base error boundary,
  source directory boundaries, Git ignore rules, and a Vitest smoke test.
- Configured the Vite GitHub Pages base path as `/openstudy-planner/`.
- Ran lint, test, and production build checks for DEV-001.
- Defined the unified `Task` model, constrained subject, study-format, and
  status enumerations, task factory, and baseline validation in `src/models`.
- Added DEV-002 unit coverage for task creation, optional fields, enums,
  duration validation, local dates, and generated timestamps.
- Added a browser `localStorage` data access layer with an injectable storage
  dependency for tests, one complete application snapshot, safe parsing, and
  DEV-002 `Task` validation.
- Added task read, add, update, permanent delete, complete replacement,
  application-only clear, and storage format version interfaces.
- Added explicit errors and failure protection for unavailable storage, read
  failures, corrupted data, incompatible versions, invalid tasks, duplicate
  IDs, quota exhaustion, and failed writes.
- Added DEV-003 unit coverage for local persistence, complete replacement,
  data corruption, write-failure preservation, application-key-only clearing,
  and absence of network interface calls during normal data operations.
- Ran the configured lint, test, and production-build scripts successfully
  with the bundled Node runtime because `npm` is not available on the current
  PowerShell PATH.
- Added the three confirmed first-level pages: 今日, 任务库, and 数据与说明.
- Added a shared responsive application layout with text-labelled primary
  navigation and a clear current-page state.
- Added HashRouter routes for GitHub Pages compatibility, a 今日 default route,
  and an unknown-route redirect back to 今日.
- Added DOM-based navigation coverage for the default route, all three entry
  names, current-page state, invalid routes, and hash parsing after remount.
- Added a shared feedback provider for non-blocking success and failure
  messages, retry actions, field errors, and confirmation dialogs.
- Added a task business-service layer and `useReducer` + Context application
  state. All task writes use the existing localStorage data-access layer.
- Implemented optional subject and study-format quick selection, task creation,
  editing, persistence, task-library status filters, and explicit empty states.
- Implemented today-priority add/remove rules, non-blocking 1—3 item guidance,
  insertion-order display, legal task-status transitions, removal/restoration,
  and confirmed permanent deletion.
- Implemented the Today core task list, quick creation with opt-out of the
  default priority membership in the full form, execution actions, and the
  non-blocking count notice for unresolved past priorities.
- Added focused business and component tests for task persistence, validation,
  filters, priorities, unlimited priority count, transitions, removal and
  restoration, deletion cancellation, storage write failure feedback, past
  priority notices, and the absence of normal-operation network calls.
- Ran lint, test, and production build checks successfully with the bundled
  Node runtime because `npm` is not on the current PowerShell PATH.
- Implemented an in-memory replan draft with result preview, six explicit
  user-selected operations, cancellation, skipped-task preservation, and one
  full-snapshot atomic save for all selected changes.
- Added the secondary replan route and Today-page entries for current and
  unresolved past priorities without adding a new primary navigation item.
- Implemented versioned JSON backup export, safe import parsing and preview,
  confirmed full replacement without merging, application-key-only data
  clearing, and the data/privacy/copyright information page.
- Added DEV-034, DEV-035, and DEV-038-focused unit and DOM coverage for six
  replan outcomes, validation, cancellation, atomic write failure protection,
  backup validation/replacement, import and clear cancellation, and local-only
  network boundaries.
- Completed responsive release checks for 360 CSS-pixel mobile and desktop
  layouts. The mobile navigation, six replan actions, confirmation dialog,
  long text handling, and form values after a viewport change were checked
  without adding device-specific features.
- Corrected release-blocking page states: a failed data read prevents
  data-changing controls until retry succeeds; normal save failures remain
  operation feedback and no longer masquerade as read failures; Today now
  distinguishes an all-completed state; and the library distinguishes a truly
  empty task library from an empty filter result.
- Added focused Vitest/DOM coverage for read failure protection, completed and
  filter empty states, empty data actions, 360/desktop core flows, six visible
  replan actions, and long task text with its primary action.
- Rewrote README with the actual MVP scope, local run commands, privacy and
  backup boundaries, contribution guidance, MIT license, and GitHub Pages
  setup instructions.
- Added the minimal GitHub Pages workflow with `npm ci`, lint, test, and build
  gates before deployment of `dist`; Vite keeps `/openstudy-planner/` and
  HashRouter remains in use.
- Completed the DEV-041 source audit: no normal source network interface, no
  tracked secret/backup file, and no MVP-external feature entry was found.
- Pre-commit release review removed the inert task-library creation entry while
  data loading fails, clarified that export-download failure leaves data
  unchanged, and narrowed GitHub Pages permissions to the deployment job.

## In progress

- No implementation task is currently in progress.

## Not started

- DEV-042 and DEV-043 are P1 tasks and were intentionally not implemented in
  this release batch.
- GitHub Pages is not yet public: the repository owner must enable GitHub
  Actions as the Pages source before the first successful workflow deployment.

## Next action

Complete a human pre-commit review, then enable the GitHub Pages source and
intentionally commit the release batch when the repository owner is ready.

## Current constraints

- No account system.
- No cloud synchronization.
- No AI planning.
- No Pomodoro timer.
- No complex statistics.
- No automatic rollover of unfinished tasks.
- Ordinary task creation requires only a task name.
- One to three priority tasks are a recommendation, not a hard limit.
- Task content remains local by default.
- Local storage is not described as absolutely secure or completely anonymous.
