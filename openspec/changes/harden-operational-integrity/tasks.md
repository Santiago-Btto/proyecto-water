## 1. Test Foundation

- [x] 1.1 Add Vitest and a `test` script that runs the suite from the project root without starting Vite.
- [x] 1.2 Create the integrity helper test file and write failing tests for rejecting sales with no positive-quantity item and sales with a zero calculated total.

## 2. Sale Validation

- [x] 2.1 Extract a pure sale-validity helper that satisfies the failing sale-validation tests, including a valid positive-quantity, positive-total sale case.
- [x] 2.2 Integrate the helper into `VisitaSheet` so invalid sales remain open and display a validation error before any persistence operation begins.
- [x] 2.3 Add or extend tests for the valid-sale path and run the focused suite after refactoring.

## 3. Atomic Visit Persistence

- [x] 3.1 Write failing unit tests for deriving the final client balance, container balances, and net enabled-stock effect for a new visit and an edited visit.
- [x] 3.2 Extract pure visit-effect helpers that make the new-visit and edit tests pass while preserving legacy container-field normalization.
- [x] 3.3 Write failing tests for the transaction boundary: it writes visit, client, and enabled stock as one operation and reports a transaction failure without reporting a save.
- [x] 3.4 Implement the Firestore transaction-backed visit save that reads current affected records, derives effects, and writes all required records atomically.
- [x] 3.5 Replace the visit-specific `mutate` and standalone stock update path with the transaction-backed operation, leaving generic persistence for unrelated changes unchanged.

## 4. Save Feedback And Verification

- [x] 4.1 Make `VisitaSheet` await the save result, prevent duplicate submissions while pending, close only after success, and retain entered data with an actionable persistence error after failure.
- [x] 4.2 Add tests covering save-success and save-failure outcomes at the selected unit boundary, including the surfaced error contract.
- [x] 4.3 Run the complete automated test suite and `npm run build`; fix only regressions introduced by this change.
