## Context

See `proposal.md` and the delta specs for the behavioral contract. The application is a Vite/React delivery application whose visits, clients, and stock use a local `mutate` path backed by Firestore persistent cache. The in-progress `fix-debt-payment-edit-sync` change owns the current debt-edit regression and must not be changed by this work. Subscription delivery effects need to join the same local mutation boundary without introducing `runTransaction` or changing authentication or security rules.

## Goals / Non-Goals

**Goals:**
- Persist auditable monthly commercial snapshots independently from mutable promotion configuration.
- Make the subscription state explicit in client, administration, delivery, payment, and operational-summary surfaces.
- Calculate subscription attribution, excess individual sale, and reversible visit effects from pure domain helpers before UI integration.
- Preserve offline-first local visibility and queued remote synchronization for every subscription-related mutation.
- Make legacy eligible clients safe by default: no subscription means ordinary sales continue unchanged.

**Non-Goals:**
- Change the scope or code of `fix-debt-payment-edit-sync`.
- Add partial subscription payments, mid-month plan changes, support for dispenser types other than `maquinaFrioCalor`, or automatic renewal.
- Reclassify subscription payment as ordinary sale revenue, ordinary debt collection, or a stock movement.
- Change authentication, the client-side administrator PIN, Firestore security rules, or use Firestore `runTransaction`.

## Decisions

### Store immutable subscriptions separately from promotions

Create promotion documents with `id`, `activo`, `cantidadX20`, `precioMensual`, `nombre`, and audit timestamps. Create one subscription document per client and `YYYY-MM` period with a deterministic unique key, client reference, promotion reference, snapshots (`promocionNombre`, `cantidadX20`, `precioMensual`), `cantidadConsumida`, derived `cantidadRestante`, `estadoPago` (`pendiente`, `pagada`, `vencida`), and a full-payment receipt (`monto`, `metodo`, `fecha`) when settled. Store a compact current-period subscription summary on the client solely for fast UI lookup; the subscription document remains authoritative.

**Rationale:** A price or activation change cannot rewrite the agreed commercial terms, while a period key prevents two intentional subscriptions for one client/month in the local data model.

**Alternative considered:** Keeping only promotion id and current price on the client was rejected because configuration changes would alter historical commercial data and make audit impossible.

### Derive status and eligibility from the period clock and durable payment state

Use a single injected local-date/period helper for selection-window and overdue decisions. A subscription is selectable only on days 1-10 for an eligible client with no subscription for that period and no unpaid overdue earlier subscription. Payment records the snapped full total with an existing method; status is derived as paid, pending through day 15, or overdue from day 16. The UI persists the resulting status when it changes as part of a normal local mutation so offline views are deterministic, while rendering still derives the current overdue state from the clock.

**Rationale:** One date boundary avoids different admin and delivery interpretations, and the persisted status remains useful in offline summaries without making the device clock the sole permanent source of truth.

**Alternative considered:** A server-scheduled job was rejected because the application must work offline and the request excludes infrastructure and security changes.

### Split a visit's x20L quantity into covered and excess before existing sale calculation

Add pure subscription helpers that accept the visit, matching current-period subscription, and clock. They determine eligible covered x20L quantity as the minimum of delivered x20L and remaining quota, return explicit attribution `{ subscriptionId, periodo, cantidadX20 }`, and produce the remaining x20L as an ordinary item priced with the current normal unit price. The visit stores both its attribution and its ordinary-sale items/totals, so later price changes cannot alter saved sales or subscription history.

**Rationale:** The delivery sheet can present covered, remaining, and excess quantities before save, while the established sales/debt/stock calculation only receives actual excess sale value.

**Alternative considered:** Discounting a single x20L line after the existing sale calculation was rejected because it obscures quota consumption and can contaminate ordinary sale and debt metrics.

### Recompute attribution by replacing the old visit effect in one local mutation

Extend the offline-first visit mutation seam to load the previous visit attribution, reverse it from its referenced subscription, calculate the new attribution against the resulting quota, and commit the revised visit, client, enabled stock, and each affected subscription summary together in one `mutate` call. Edit and delete use the same replacement helper. If an edit changes period or subscription, both old and new subscriptions are included. Remote persistence follows the existing local-cache mutation mechanism; no subscription-specific write may use `runTransaction`.

**Rationale:** Reversal from stored attribution avoids reconstructing history from mutable promotions or prices and prevents locally visible half-updates while disconnected.

**Alternative considered:** Incrementing a quota counter independently on each save was rejected because retry, edit, and deletion could double-count or leave quota consumed.

### Keep subscription accounting and metrics distinct

Provide subscription-specific summaries: active subscriptions, snapped monthly billed total, paid total, pending total, overdue total/count, total quota, consumed quota, and remaining quota. Existing sales revenue, debt, debt collection, and stock indicators continue using only their current inputs. Subscription payment UI reuses existing method choices but saves to the subscription receipt, not the ordinary debt-payment fields.

**Rationale:** The monthly price includes machine rental and covered product, so mixing it into individual sale or debt metrics would distort existing dashboards.

**Alternative considered:** Adding subscription payment to `deudaAcumulada` was rejected because it would make pre-payment delivery look like ordinary credit sales and alter debt metrics.

### Make migration opt-in, additive, and reviewable

Deploy schema readers first with missing subscription fields normalized to "no subscription". Provide an administrator-only migration preview that lists eligible legacy clients and permits explicit, small-batch creation of a selected-period subscription only after confirmation. It creates new subscription documents and client summaries only when no period record exists, records a migration marker/audit detail, never overwrites promotion snapshots or visits, and exposes a per-record rollback action that removes only migration-created subscription data after checking it has no attributed deliveries or payment.

**Rationale:** Existing machine clients must remain operable without an inferred plan, and historic data cannot reliably establish a chosen promotion or price.

**Alternative considered:** Automatically creating subscriptions from machine clients or recent visits was rejected because it fabricates commercial consent and would make destructive bulk writes difficult to undo.

## Risks / Trade-offs

- Device time determines local selection and overdue presentation -> Centralize clock injection, test dates on each boundary, and reconcile visible status after reconnect without altering immutable snapshots.
- Multiple offline devices can select or consume the same quota before synchronization -> Expose pending-sync state, use deterministic period identity, and surface a reconciliation conflict rather than silently overwriting an existing remote subscription.
- A visit edit can move attribution between periods -> Store period and subscription id on the visit, reverse before recomputing, and test both subscriptions in the mutation result.
- A subscription payment is captured while offline -> Keep it pending in persistent local cache with its selected existing method and make sync state visible; do not also create an ordinary debt payment.
- The current application is monolithic -> Extract small pure subscription helpers and focused seams, avoiding a broad UI rewrite.
- Migration tooling can create unwanted records -> Default to preview, explicit selection, idempotent create-only behavior, audit markers, and safe rollback eligibility checks.

## Migration Plan

1. Run the existing focused tests and complete/coordinate the pending debt-edit change before modifying its shared visit-mutation seam.
2. Add failing pure-domain tests for periods, eligibility, snapshots, payment status, quota split, reversals, and isolated metrics; implement the minimum helpers until green.
3. Add failing mutation tests covering create, edit, delete, offline queued success, and no-partial-local-state failure; integrate the smallest local `mutate` extension without `runTransaction`.
4. Add the administration, customer-summary, payment, delivery, and metrics UI only after their helper contracts are green.
5. Deploy reader-compatible code first. Verify legacy machine clients show "sin suscripcion" and ordinary sales remain available.
6. Run the manual migration preview in small explicit batches, reconciling each created record before proceeding. Do not run automatic backfill writes.
7. Manually test offline subscription creation, delivery, payment, visit edit/delete, reconnect, and conflict messaging before release.
8. Roll back the client build if defects are found. Migration-created records may be rolled back only when they have no payment or attributed deliveries; otherwise correct through an auditable compensating action rather than deletion.
