## Context

See `proposal.md` for motivation and `specs/operational-integrity/spec.md` for the behavior contract. `src/App.jsx` currently computes a replacement visit and related client state in memory, calls `mutate`, writes changed documents independently, and then separately adjusts stock through `moverStockRepartidor`. These asynchronous writes do not share a success boundary and their boolean failures are not returned to the visit form. The project has no test command or test dependencies.

## Goals / Non-Goals

**Goals:**
- Make one delivery-visit save the authoritative persistence boundary for the visit document, client document, and conditional stock document.
- Re-read transaction inputs to calculate edits from current Firestore state rather than a potentially stale UI snapshot.
- Keep pure validation and visit-effect calculations independently testable.
- Give the form an explicit pending and failure state around persistence.

**Non-Goals:**
- Change the client-side administrator PIN, add Firebase Authentication, or change Firestore security rules.
- Convert unrelated client, expense, configuration, undo, or redo writes to transactions.
- Provide offline queue semantics for transactional saves; an unavailable transaction is reported as a save failure for retry.

## Decisions

### Dedicated visit-save transaction

Add a dedicated asynchronous persistence operation for creating and editing visits. It will use one Firestore transaction to read the current client, previous visit (for an edit), and stock document when stock is active; derive the final client and stock values; and write every affected document only after all validation succeeds.

The UI will no longer use generic `mutate` or the standalone `moverStockRepartidor` operation for a visit save. Generic diff persistence remains for unrelated operations.

**Rationale:** `setDoc` and `increment` across separate awaited and un-awaited calls cannot guarantee that related records commit together. A transaction retries against concurrent edits and commits its writes atomically.

**Alternative considered:** `writeBatch` was rejected because it cannot read current documents atomically, which is required to recompute balances and the net effect of an edited visit under concurrent activity.

### Pure domain helpers before UI integration

Extract the sale-validity check and calculations that derive client and stock effects into pure exported helpers in a small module. The transaction and form will both use these helpers as appropriate, avoiding independent formulas for the same operation.

**Rationale:** a small pure boundary enables strict TDD for invalid sales, new visits, edits, and transaction failures without mounting the entire monolithic app.

**Alternative considered:** keeping helpers embedded in `App.jsx` was rejected because it makes focused tests depend on the complete UI module and Firebase initialization.

### Explicit persistence lifecycle in the form

`VisitaSheet` will await its save callback, disable duplicate submissions while it is pending, close only after success, and display a persistence-specific message on rejection. Client-side validation errors remain in the form and submitted values are retained.

**Rationale:** closing optimistically hides failed writes and forces re-entry of operational data.

**Alternative considered:** relying on snapshot listener errors was rejected because listener errors do not reliably identify the failed user operation or preserve its UI context.

### Vitest-based unit test foundation

Add Vitest and a `test` package script. Tests will first target the pure integrity helpers and a mocked transaction adapter or Firestore transaction callback boundary.

**Rationale:** Vite projects can run Vitest with minimal configuration, and unit tests provide deterministic coverage for concurrency-sensitive calculations without a live Firebase project.

**Alternative considered:** browser-only tests were rejected for the initial scope because they add setup cost and do not replace focused transaction behavior tests.

## Risks / Trade-offs

- Firestore transactions require network access and can retry their callback -> Keep the callback deterministic and free of UI side effects; report transaction rejection to the form.
- Existing visits may not have all newer container fields -> Normalize legacy fields through existing compatibility helpers before deriving effects.
- A transaction reads multiple documents -> Limit it to only the client, visit being edited, and enabled stock document.
- Generic undo/redo can still create independent writes for unrelated actions -> Exclude visit saves from generic persistence and retain the existing behavior outside this change.

## Migration Plan

1. Add the test runner and establish failing tests for the new validation and persistence contracts.
2. Implement pure helpers and the transaction-backed visit save, then integrate the form lifecycle.
3. Run the full test suite and production build before deployment.
4. Deploy the client. No data migration is required because the existing visit, client, and stock document shapes remain compatible.
5. If a production defect is found, roll back the client build; no schema or security-rule rollback is necessary.
