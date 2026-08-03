# OpenStudy Planner Decisions

This document records confirmed product and technical decisions.

## DEC-001 — MVP core workflow

The MVP only validates:

> Create task → Select today's priorities → Start → Mark result → Replan unfinished tasks

## DEC-002 — Priority task order

Today's priority tasks are displayed in the order they were added.

The MVP does not support drag-and-drop sorting.

## DEC-003 — Quick creation from Today

A task created from the Today page is added to today's priorities by default.

The interface must clearly explain this, and the user may disable it before saving.

## DEC-004 — Active tasks and today's priorities

Only active tasks may be directly added to today's priorities:

- Pending
- In progress
- Partially completed

A completed task must first be reopened.

A removed task must first be restored.

## DEC-005 — Date handling

Planned dates and priority dates use the user's local calendar date.

They must not be determined by directly converting the current time to a UTC date.

## DEC-006 — Split tasks

Split tasks are not automatically added to today's priorities.

The user decides separately for each new task.

## DEC-007 — Import behavior

The MVP imports a compatible backup by replacing current application data.

It does not merge backups with existing tasks.

## DEC-008 — Local storage failure

If local storage is unavailable or writing fails, the application must clearly state that the data was not saved.

The MVP does not provide a separate read-only mode.

## DEC-009 — License

The project uses the MIT License.

## DEC-010 — MVP technical foundation

Confirmed on 2026-08-03 for the first MVP implementation:

- React with TypeScript and Vite;
- npm for dependency management;
- native CSS for styling;
- Vitest as the baseline test runner;
- GitHub Pages as the deployment target, with Vite configured for the
  `/openstudy-planner/` repository subpath.

HashRouter will be added when page navigation is implemented. Application state
will use `useReducer` with Context when state management is introduced. Browser
data will use `localStorage` when data access is introduced. Playwright is
deferred until core-flow testing is needed.

DEV-001 does not install React Router or Playwright because neither is used by
the project foundation.

## Open decisions

The following decisions remain open:

- backup file extension and schema;
- supported browser baseline;
- text field length limits;
