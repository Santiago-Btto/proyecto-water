## 1. Debt Replacement Regression Tests

- [x] 1.1 Run the existing focused operational-integrity suite and record its passing baseline before modifying production files.
- [x] 1.2 Write a failing pure-effect test for replacing a persisted fiado visit with a Mercado Pago prior-debt payment, asserting that `deudaAcumulada` first removes the original fiado and then applies the debt payment.
- [x] 1.3 Implement only the debt-effect change required by the failing test, if the existing pure helper does not already satisfy it, and run the focused test to confirm green.
- [x] 1.4 Add a second, transaction-boundary test for the same replacement scenario that asserts a successful result and the corrected client write, then run the focused suite.

## 2. Transactional Delivery Save Integration

- [x] 2.1 Add a focused failing test at the narrowest existing seam that proves a delivery visit save delegates to the atomic transaction path and returns its `{ ok, error? }` result to the caller.
- [x] 2.2 Make `guardarVisita` asynchronous, build the required Firestore references, delegate to `saveVisitAtomically`, and return the helper result without duplicate local persistence or stock movement.
- [x] 2.3 Clear active visit-edit UI state only after a successful transaction result; retain it on failure so `VisitaSheet` can keep the entered data and show its existing error path.
- [x] 2.4 Run the focused tests after the integration change and refactor only duplicated visit-save calculations that are no longer used by the route.

## 3. Verification

- [x] 3.1 Run the current focused suites before the new form-boundary work and record the passing baseline; stop and report any pre-existing failure.
- [x] 3.2 Add a failing regression test at the narrowest existing form or submit seam for an invalid sale, asserting its validation message is rendered next to the sticky "Guardar visita" button and persistence is not invoked.
- [x] 3.3 Add a failing regression test for a persistence failure result and a separate thrown save callback, asserting retained form data, retryable error feedback next to "Guardar visita", and pending state cleared in both cases.
- [x] 3.4 Add a failing regression test for an offline or connection failure that asserts the displayed error instructs the worker to check connectivity before retrying.
- [x] 3.5 Add a failing regression test for one positive-quantity x20 bidon sold fiado with a valid total, asserting validation accepts it and reaches the save callback.
- [x] 3.6 Implement the minimum `try`/`catch`/`finally` submit-boundary behavior and colocated error rendering needed to make the new tests pass, preserving all existing sale-validation rejections.
- [x] 3.7 Investigate any failing x20 fiado regression and make only the narrow fix required for the valid sale to enter the normal save path; rerun focused tests after each change.
- [x] 3.8 Run the complete automated test suite and `npm run build`; fix only regressions introduced by this change.
- [ ] 3.9 Manually verify the edit flow with an existing fiado visit changed to a Mercado Pago prior-debt payment, confirming the saved visit, customer debt, and "Plata en la calle" agree.
- [ ] 3.10 Manually verify an invalid sale, a connection failure, and a one-x20-bidon fiado sale on desktop and mobile, confirming feedback appears by "Guardar visita", retry is possible, and the valid sale starts saving.
