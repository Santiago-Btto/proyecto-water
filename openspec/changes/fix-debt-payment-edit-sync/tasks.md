## 1. Local Debt-Replacement TDD

- [x] 1.1 Run the focused operational-integrity suite and record its passing baseline before modifying production files; stop and report any pre-existing failure.
- [x] 1.2 Write a failing test for a customer with $1500 debt containing a persisted $500 fiado visit, edited into a $1000 Mercado Pago prior-debt payment; assert the resulting `deudaAcumulada` is $0.
- [x] 1.3 Implement only the change needed to make the debt-replacement test pass and run the focused test to confirm green.
- [x] 1.4 Add a second failing edge-case test for the same replacement through the existing local-state seam, then generalize only as needed and rerun the focused suite.

## 2. Offline-First Delivery Save TDD

- [x] 2.1 Add a failing test at the narrowest existing seam proving the delivery save applies the edited visit and recalculated client in one `mutate` local-state operation and returns `{ ok, error? }` to the sheet.
- [x] 2.2 Implement the minimum change to preserve the persistent-cache `mutate` route, apply all visit effects together locally, and ensure the delivery save path does not call Firestore `runTransaction`.
- [x] 2.3 Add a second failing test that a failed local mutation does not report a partial visit/customer state as saved; implement the minimum error result and rerun focused tests.
- [x] 2.4 Add a failing test that a successful local result clears edit state while a failure retains it; implement the minimum sheet integration and refactor only duplicate calculations.

## 3. Dashboard and Form Regression TDD

- [x] 3.1 Add a failing dashboard-level test for the exact fiado-to-Mercado-Pago replacement asserting "Plata en la calle" is $0 from the resulting local state; implement the minimum fix and confirm green.
- [x] 3.2 Add failing tests for an invalid sale, a failed save result, and a thrown save callback, asserting retained data, feedback next to "Guardar visita", and cleared pending state; implement the minimum form-boundary behavior.
- [x] 3.3 Add a failing test for one positive-quantity x20 bidon sold fiado with a valid total, asserting validation accepts it and invokes the save path; retain existing invalid-sale rejections.
- [x] 3.4 Run the focused suites after every refactor, then run the complete automated test suite and `npm run build`; fix only regressions introduced by this change.

## 4. Offline/Reconnect Manual Verification

- [ ] 4.1 While offline, edit the persisted $500 fiado visit for the customer at $1500 debt into a $1000 Mercado Pago prior-debt payment; verify the local visit update, customer debt of $0, "Plata en la calle" of $0, and visible pending or success feedback.
- [ ] 4.2 Reconnect and verify the queued local save synchronizes without a server transaction and local values remain coherent.
- [ ] 4.3 On desktop and mobile, verify invalid-sale feedback, a non-queueable connection failure with retry guidance, and the valid one-x20-bidon fiado save path.
