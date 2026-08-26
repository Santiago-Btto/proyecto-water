## 1. Strict TDD Date-Range Contract

- [x] 1.1 Run `npm test` before modifying existing production files and record the passing-test baseline; stop and report any pre-existing failure before proceeding.
- [x] 1.2 RED: Add `src/dashboardCalendarFilters.test.js` with a failing unit test that imports the planned date-range membership API and proves a Sunday record is included while the preceding Saturday is excluded when the current date is Sunday; run `npm test -- dashboardCalendarFilters.test.js` and verify it fails because production support does not exist yet.
- [x] 1.3 GREEN: Add the minimum pure local-date calendar-range helper needed to make the Sunday boundary test pass; run `npm test -- dashboardCalendarFilters.test.js` and verify it passes.
- [x] 1.4 TRIANGULATE: Add a second failing Week test for a Saturday current date that includes that week's Sunday and Saturday but excludes the following Sunday; generalize only the helper logic required, then run `npm test -- dashboardCalendarFilters.test.js` and verify both Week boundary tests pass.
- [x] 1.5 TRIANGULATE: Add failing Month tests for the final day of a month and the first day of the next month, asserting inclusion only for records sharing the current `YYYY-MM`; retain or minimally generalize the helper, then run `npm test -- dashboardCalendarFilters.test.js` and verify all Sunday, Saturday, month-end, and new-month cases pass.
- [x] 1.6 REFACTOR: Improve helper/test names or remove duplication without changing behavior; run `npm test -- dashboardCalendarFilters.test.js` after each refactor and verify all boundary tests remain green.

## 2. Dashboard Integration

- [x] 2.1 Run the existing dashboard-related test baseline before editing `src/App.jsx`; replace its nested rolling Week membership check with the tested calendar helper for both visits and expenses, then run `npm test -- dashboardCalendarFilters.test.js` and verify shared filtering still satisfies all Week and Month boundary cases.
- [x] 2.2 Update the Week range label in `src/App.jsx` to describe the Sunday-to-Saturday calendar week rather than "Últimos 7 días"; verify through code review that Today, selected day, Month, and all-history branches retain their existing selection behavior.
- [x] 2.3 Run `npm test` and `npm run build`; verify the complete Vitest suite passes and the Vite production build succeeds.
