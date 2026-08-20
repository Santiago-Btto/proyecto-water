## Context

See `proposal.md` for motivation and the delta specs for the behavior contract. The delivery route already has an offline-first `mutate` path backed by Firestore's persistent local cache. Its debt arithmetic correctly handles replacing a persisted $500 fiado visit when the customer's total debt is $1500 with a $1000 Mercado Pago payment of prior debt: the resulting customer debt is $0. The route must apply that recalculated customer and the edited visit together in local state, return an `{ ok, error? }` result to `VisitaSheet`, and retain the sheet's feedback and pending behavior. Firestore `runTransaction` is explicitly excluded from this save path.

## Goals / Non-Goals

**Goals:**
- Give every delivery visit save one offline-first local mutation boundary for its visit, client, and applicable stock effects.
- Preserve the existing local replacement arithmetic when an edit replaces debt effects.
- Ensure the visit and recalculated client become visible together through the persistent local cache, including while offline.
- Preserve the form's pending, success, and failure behavior through a returned result or thrown-error recovery.
- Keep validation failures and persistence failures visible beside the sticky save control, with actionable connectivity guidance.
- Confirm that a positive-quantity x20 bidon sold fiado remains a valid sale and cannot silently leave the form without feedback.
- Cover the reported debt-edit regression with a focused test-first sequence.

**Non-Goals:**
- Change debt calculation rules, payment-entry fields, historical visit data, or stock behavior beyond applying existing effects in the visit's local mutation.
- Convert this or unrelated `mutate` operations to transactions.
- Change authentication, client-side PIN handling, or Firestore security rules.
- Relax the existing sale-validity rules or reinterpret a sale with no positive quantity or zero total as valid.

## Decisions

### Preserve one offline-first local mutation for delivery saves

`guardarVisita` will retain the persistent-cache `mutate` route. In one local mutation it will replace the visit, derive the client from the prior visit and edited visit, and update the applicable stock state. It will return an `{ ok, error? }` result to the caller. The edit state will clear only after a successful local result; listeners can subsequently confirm remote synchronization without being required for immediate feedback.

**Rationale:** The app must remain usable offline and expose the save through Firestore's persistent local cache. Updating the visit and derived client in one local state mutation prevents a locally visible half-update and does not block on server availability.

**Alternative considered:** Using `runTransaction` or the existing transaction helper was rejected because server transaction availability conflicts with the required offline-first delivery workflow.

### Keep visit-specific persistence local and derive all related effects together

The visit save path will not call Firestore `runTransaction`. Its `mutate` callback will apply the edited visit, recalculated customer, and enabled stock effect from the same prior local snapshot. No related write may be issued outside that mutation for a visit save.

**Rationale:** A single local mutation provides a coherent offline-visible result while persistent local cache queues synchronization for reconnection.

**Alternative considered:** Separate local writes for the visit and customer were rejected because the sheet and dashboard could temporarily show incompatible debt information.

### Extend the focused local-state test suite first

Before changing production routing, add a failing test that starts with a customer debt of $1500 containing a persisted $500 fiado visit, replaces that visit with a $1000 Mercado Pago prior-debt payment, and asserts a final `deudaAcumulada` of $0. Add a second case at the local mutation boundary that verifies the edited visit and corrected customer state are committed together. Add a dashboard-level assertion that "Plata en la calle" is $0 for the resulting local state.

**Rationale:** The pure calculation, local mutation, and dashboard total separately prove the accounting invariant, persistence boundary, and operational indicator without a mounted application or live Firebase.

**Alternative considered:** Testing a Firestore server transaction was rejected because it cannot establish the required offline behavior and is outside the delivery save design.

### Contain all submit outcomes in the form save boundary

`VisitaSheet` will wrap invocation of its save callback in `try`/`catch`/`finally`. It will clear the pending state in `finally`, close or reset only after an explicit successful result, and retain the entered data for either an `{ ok: false, error }` result or a thrown exception. Both invalid-sale validation messages and save errors will render adjacent to the sticky "Guardar visita" button. Connection-related failures will identify the connection issue and direct the worker to verify connectivity and retry; other persistence failures will provide a retryable save message without exposing raw internal errors.

**Rationale:** A callback can reject or throw instead of returning the expected result. A `finally` boundary prevents a permanently disabled save control, while colocating feedback with that control makes the failed action and recovery path clear on small screens.

**Alternative considered:** Relying exclusively on callback result objects was rejected because it leaves the form stuck pending when an unexpected exception escapes.

### Preserve and test the valid x20 fiado path

The implementation investigation will trace validation through submit and persistence for a sale containing one positive-quantity x20 bidon marked fiado. The regression test will assert that this sale passes validation and reaches the save path. Any defect found will be corrected narrowly without changing the rejection behavior for empty, zero-quantity, or zero-total sales.

**Rationale:** The reported silent outcome can stem from validation, error presentation, or submit-state handling. Testing the complete valid input at the existing narrowest seam distinguishes it from intentionally invalid sales.

**Alternative considered:** Broadening sale validation to avoid the reported issue was rejected because it would accept invalid sales and violate the existing integrity contract.

## Risks / Trade-offs

- A local mutation can be queued while the server is unavailable -> Return clear pending/success feedback from the local save, retain actionable offline feedback for failures, and manually confirm synchronization after reconnecting.
- A related effect outside the local mutation can expose inconsistent local data -> Keep visit, client, and enabled stock changes in the same mutation.
- Tests may cover calculation and helper persistence but not component wiring directly -> Add a small, testable routing seam only if the existing test boundary cannot prove `guardarVisita` delegates and returns the result; do not introduce UI-test infrastructure solely for this regression.
- An unexpected save exception can bypass result-based UI logic -> Catch it at the form boundary, always clear pending state, and expose a retryable message beside the save button.
- The x20 fiado report may be a connectivity symptom rather than validation -> Cover the valid input separately from connection failures so the diagnosis does not weaken validation rules.

## Migration Plan

1. Run the focused existing integrity tests to establish a passing baseline.
2. Add failing regression tests for the exact fiado-to-Mercado-Pago replacement, local mutation state, and dashboard debt total.
3. Correct the existing `mutate` path until the focused tests pass, without adding `runTransaction` to the delivery save path.
4. Add failing tests for a thrown save callback, visible validation and persistence feedback, and one positive-quantity x20 bidon sold fiado reaching the save path; implement the minimum form-boundary changes until green.
5. Run the complete test suite and production build.
6. Manually save the edit while offline, confirm local visit/customer/dashboard values, reconnect, and confirm queued synchronization without a server transaction. Deploy without a data migration; if a regression appears, roll back the client build because document shape and security rules are unchanged.
