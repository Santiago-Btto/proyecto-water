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

- [x] 3.1 Run the complete automated test suite and `npm run build`; fix only regressions introduced by this change.
- [ ] 3.2 Manually verify the edit flow with an existing fiado visit changed to a Mercado Pago prior-debt payment, confirming the saved visit, customer debt, and "Plata en la calle" agree.
