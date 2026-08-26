## Why

The dashboard's Week filter currently reports the last seven elapsed days, so its results change daily rather than representing the operational calendar week. The Month filter already compares calendar month keys, but its reset behavior must be protected by boundary tests.

## What Changes

- Change the administrator dashboard Week filter to include records from Sunday at 00:00 through the following Saturday, inclusive, based on the current local calendar week.
- Update the Week filter label so it no longer describes a rolling seven-day period.
- Preserve the Month filter as a current-calendar-month filter that resets on the first day of a new month.
- Add strict TDD coverage for week and month boundaries shared by visits and expenses.

## Capabilities

### New Capabilities
- `dashboard-calendar-filters`: Defines calendar-aligned Week and Month filtering for administrator dashboard metrics, visits, and expenses.

### Modified Capabilities

- None.

## Impact

- Affected code: `src/App.jsx`, with a small testable date-range helper to be introduced during implementation and its Vitest test file.
- Affected UI: Administrator dashboard range selector, summary metrics, visit list, and expense totals that use the selected range.
- No API, persistence schema, Firebase, or dependency changes.
