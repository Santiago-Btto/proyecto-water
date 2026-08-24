## 1. Baseline And Domain Contracts

- [x] 1.1 Confirm that `fix-debt-payment-edit-sync` has completed or coordinate its shared visit-mutation seam before editing it; verify its focused tests pass without changing that change's task scope.
- [x] 1.2 Run `npm test` as the safety-net baseline and record the passing count; stop and report any pre-existing failure before modifying existing production files.
- [x] 1.3 Write failing unit tests for promotion validation (only 4, 6, 8, 10 x20L and positive inclusive monthly price) plus valid 4 and 10 cases; verify RED with the focused Vitest command.
- [x] 1.4 Implement the minimum pure promotion validation and snapshot helper; verify the focused promotion tests are GREEN and refactor without changing their results.
- [x] 1.5 Write failing unit tests with an injected clock for eligible/ineligible clients, days 1/10/11, duplicate monthly selection, immutable snapshots, and prior overdue blocking; verify RED.
- [x] 1.6 Implement the minimum pure period, eligibility, payment-state, and create-only monthly identity helpers; verify all selection/status tests are GREEN, include at least happy and boundary cases per behavior, then refactor.

## 2. Subscription Records And Administration

- [x] 2.1 Write failing focused tests for creating, editing, activating, and deactivating promotions while preserving existing subscription snapshots; verify RED.
- [x] 2.2 Add the promotion data adapter and administrator management UI using the existing local persistent-cache mutation convention; verify the administration tests are GREEN and an invalid quota cannot be saved.
- [x] 2.3 Write failing focused tests for an eligible client's first monthly selection, a duplicate selection rejection, and an ineligible client's rejection; verify RED.
- [x] 2.4 Add durable per-client/per-period subscription records and a compact client summary in one local mutation, without `runTransaction`; verify selection tests are GREEN and existing clients without records normalize to no subscription.
- [x] 2.5 Add the client subscription summary UI for period, payment state, quota consumed/remaining, overdue, and no-subscription state; verify component or selected UI-boundary tests cover eligible and legacy client views.

## 3. Payment And Subscription Metrics

- [x] 3.1 Write failing unit tests for pending through day 15, overdue from day 16, full payment with each existing payment-method value, and the rule that subscription payment does not change ordinary debt totals; verify RED.
- [x] 3.2 Implement the subscription payment receipt and status transition through the existing local mutation path; verify payment tests are GREEN and ordinary debt-payment fields remain untouched.
- [x] 3.3 Write failing unit tests for separate paid, pending, overdue, quota total, consumed, and remaining subscription aggregates alongside unchanged ordinary sales/debt/stock aggregates; verify RED.
- [x] 3.4 Implement subscription metric selectors and administrator summary presentation; verify metric tests are GREEN and refactor duplicated aggregate logic.

## 4. Delivery Quota And Reversible Visit Effects

- [x] 4.1 Write failing pure-helper tests for x20L delivery wholly within quota, delivery with excess at current unit price, no subscription, and no remaining quota; verify RED.
- [x] 4.2 Implement the minimum quota-split and visit-attribution helpers; verify tests are GREEN and assert covered x20L creates no ordinary sale amount while excess does.
- [x] 4.3 Write failing mutation tests for a new attributed visit updating visit, client, enabled stock, subscription, and client summary together; verify RED and assert the save path has no `runTransaction` dependency.
- [x] 4.4 Extend the existing offline-first `mutate` visit-save seam to apply new subscription attribution in the same local mutation; verify the new-visit mutation tests are GREEN and the original visit-effect tests remain green.
- [x] 4.5 Write failing mutation tests for editing an attributed visit, moving attribution between subscriptions/periods when allowed by the visit data, and deleting an attributed visit; verify RED.
- [x] 4.6 Implement old-attribution reversal before recalculating the revised visit, including deletion; verify all edit/delete tests are GREEN and ordinary client, debt, and stock effects remain unchanged except for the revised visit's legitimate effects.
- [x] 4.7 Add delivery-sheet quota/excess feedback before save and retain actionable feedback on mutation failure; verify UI-boundary tests show quota, covered quantity, remaining quantity, excess quantity, and retryable failure state.

## 5. Safe Migration And Offline Verification

- [x] 5.1 Write failing tests for legacy `maquinaFrioCalor` clients with no subscription, migration preview selection, idempotent create-only migration, and rollback refusal after payment or attributed delivery; verify RED.
- [x] 5.2 Implement the administrator-only preview, explicit small-batch confirmation, audit marker, and eligible safe rollback path; verify migration tests are GREEN and no automatic migration writes run at application startup.
- [x] 5.3 Run `npm test` and `npm run build`; verify all automated tests and production build pass, fixing only regressions introduced by this change.
- [ ] 5.4 Manually test offline: create a valid subscription, deliver within quota, deliver excess, record a subscription payment with an existing method, edit and delete an attributed visit; verify each result is immediately visible locally and ordinary sales/debt/stock metrics remain correct.
- [ ] 5.5 Manually reconnect after the offline workflow and verify queued synchronization, no duplicate period subscription, retained snapshots, correct quota/payment state, and actionable conflict feedback if remote data already contains the period record.
- [ ] 5.6 Manually run migration preview on a non-production copy and one explicit small batch; verify only selected eligible clients receive new records, unselected clients remain unchanged, and an unconsumed unpaid migration record can be rolled back safely.
