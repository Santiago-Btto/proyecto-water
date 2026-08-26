## Context

`AdminDashboard` in `src/App.jsx` owns the selected date range and filters both visits and expenses through `perteneceAlRango`. Its Week branch currently uses a `0 <= difference < 7` elapsed-day check, while its Month branch compares `YYYY-MM` keys and already follows the calendar month. See `proposal.md` and `specs/dashboard-calendar-filters/spec.md` for the behavioral contract.

## Goals / Non-Goals

**Goals:**
- Make dashboard Week filtering deterministic for every day of the week using local calendar dates.
- Retain the existing calendar-month behavior and prove its first-day and final-day boundaries.
- Make period membership testable with Vitest without rendering the full dashboard.

**Non-Goals:**
- Change the behavior of Today, selected day, or all-history filters.
- Change stored visit or expense date formats, timezone policy, Firebase queries, or dashboard calculations unrelated to range membership.

## Decisions

### Extract date-range membership into a small pure module

Move the date parsing and range-membership logic needed by the dashboard into a small named utility module, then have `AdminDashboard` call it for visits and expenses. A pure function can accept a record ISO date, selected range, and current local ISO date, so Vitest tests control every boundary without mocking the browser clock or rendering Firebase-dependent UI.

Keeping the logic nested in `App.jsx` was considered, but it would require exporting or component-testing a very large UI module. A focused utility preserves `App.jsx` as the dashboard integration point while enabling strict unit TDD.

### Calculate inclusive local-date boundaries from ISO values

Parse persisted `YYYY-MM-DD` values as local calendar dates. For Week, derive the current Sunday by subtracting `getDay()` days from the current local date and derive the following Saturday by adding six days; membership is inclusive at both ends. For Month, retain comparison against the current date's `YYYY-MM` prefix.

Using rolling millisecond differences was rejected because it produces a trailing seven-day window and does not represent a Sunday-to-Saturday calendar period. UTC conversion was rejected because persisted dates are local operational dates and timezone conversion can shift their calendar day.

### Update the Week label to match the new contract

Replace the user-facing "Últimos 7 días" label with wording that communicates the calendar week. This prevents the UI from describing the retired rolling-window behavior.

## Risks / Trade-offs

- [Malformed or missing stored date] → Preserve the current behavior of excluding falsy dates and add defensive parsing that cannot include malformed values unexpectedly.
- [Local daylight-saving transitions] → Compare normalized local calendar dates or ISO day keys rather than elapsed milliseconds for boundary membership.
- [Refactor changes non-Week filters] → Cover Today, selected-day, and all-history passthrough behavior in the existing helper tests only as needed to retain the current contract; do not alter their dashboard wiring.

## Migration Plan

1. Add unit tests that fail against the absent calendar-range helper, including Sunday, Saturday, month-end, and new-month boundaries.
2. Add the minimum helper implementation and connect `AdminDashboard` to it.
3. Update the Week label, run the targeted Vitest suite and full test suite, then build the Vite application.

No data migration or rollout flag is required. Rollback consists of reverting the code and test changes because persisted data is unchanged.
