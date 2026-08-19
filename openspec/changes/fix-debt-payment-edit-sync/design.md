## Context

See `proposal.md` for motivation and the delta specs for the behavior contract. The completed operational-integrity change introduced `saveVisitAtomically`, which reads the current client and prior visit in a Firestore transaction before deriving replacement effects. `VisitaSheet` already awaits an `{ ok, error? }` save result, but the delivery route's `guardarVisita` still derives a cloned local database, persists it through `mutate`, adjusts stock separately, clears local editing state, and returns no result.

## Goals / Non-Goals

**Goals:**
- Give every delivery visit save one transactional persistence boundary for its visit, client, and applicable stock effects.
- Preserve the existing transaction helper's authoritative read of the stored prior visit when an edit replaces debt effects.
- Preserve the form's pending, success, and failure behavior through a returned result.
- Cover the reported debt-edit regression with a focused test-first sequence.

**Non-Goals:**
- Change debt calculation rules, payment-entry fields, historical visit data, or stock behavior beyond routing existing effects through the established transaction.
- Convert unrelated `mutate` operations to transactions.
- Change authentication, client-side PIN handling, or Firestore security rules.

## Decisions

### Delegate delivery saves to the existing transaction helper

`guardarVisita` will become asynchronous and construct the existing visit, client, and conditional stock document references for `saveVisitAtomically`. It will pass the active stock setting and return the helper's `{ ok, error? }` value directly. Local sheet and edit state will be cleared only after a successful result; Firestore listeners remain the source of refreshed operational data.

**Rationale:** The helper already reads current Firestore data, derives the difference between the persisted and edited visit, and writes affected records in one transaction. Re-implementing this calculation in `App.jsx` risks further divergence.

**Alternative considered:** Fixing only the local `mutate` debt arithmetic was rejected because it retains non-atomic writes and can use a stale prior visit.

### Remove visit-specific local persistence and stock movement

The visit save path will no longer call `mutate` or `moverStockRepartidor`; they remain available to unrelated features. The transaction helper alone will write stock when it is enabled.

**Rationale:** Separate local persistence and stock writes violate the all-or-nothing visit contract and can produce a successful-looking form result despite a failed related write.

**Alternative considered:** Retaining the local update for optimistic UI was rejected because snapshot updates provide the canonical state and the form already has an explicit pending state.

### Extend the focused integrity test suite first

Before changing production routing, add a failing test that starts from a client debt including a persisted fiado visit, replaces that visit with a Mercado Pago prior-debt payment, and asserts the recalculated `deudaAcumulada`. Add a second boundary-level case that verifies the transaction reports success and writes the corrected client result for the same replacement pattern.

**Rationale:** The pure helper verifies the accounting invariant while the transaction case guards the path that must persist it. The two cases satisfy strict TDD triangulation without requiring a mounted application or live Firebase.

**Alternative considered:** Browser-level testing of the full sheet was rejected because the reported defect is in the persistence routing and the project already has a deterministic transaction test seam.

## Risks / Trade-offs

- Transaction integration needs Firestore references from the delivery route -> Reuse the established collection and document reference conventions and preserve helper error handling.
- Snapshot refresh is asynchronous after a successful transaction -> Close the form only after success and rely on the listener instead of mutating stale local state.
- Tests may cover calculation and helper persistence but not component wiring directly -> Add a small, testable routing seam only if the existing test boundary cannot prove `guardarVisita` delegates and returns the result; do not introduce UI-test infrastructure solely for this regression.

## Migration Plan

1. Run the focused existing integrity tests to establish a passing baseline.
2. Add failing regression tests for the fiado-to-Mercado-Pago replacement at the pure-effect and transaction boundaries.
3. Route the delivery save through the transaction helper and remove the duplicate local persistence path until the focused tests pass.
4. Run the complete test suite and production build.
5. Deploy the client without a data migration. If a regression appears, roll back the client build; the document shape and security rules are unchanged.
