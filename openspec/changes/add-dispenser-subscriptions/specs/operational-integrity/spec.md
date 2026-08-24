## MODIFIED Requirements

### Requirement: Visit effects persist atomically
The system SHALL persist a new, edited, or deleted visit together with its resulting client balance, returnable-container balances, enabled delivery-worker stock adjustment, and any affected subscription quota attribution as one coherent offline-first local mutation. The visit-save path MUST NOT use Firestore `runTransaction`; it MUST make the visit, client, stock, and subscription effects visible together through the local persistent cache and queue synchronization when offline.

#### Scenario: New attributed visit updates all affected records
- **WHEN** a delivery worker saves a valid new visit with x20L bidones attributed to an active subscription and enabled stock
- **THEN** the system SHALL make the visit, client, stock, and subscription quota changes visible together locally

#### Scenario: Edited visit replaces its previous subscription effects
- **WHEN** a delivery worker saves changes to an existing visit that alter its attributed subscription x20L quantity
- **THEN** the system SHALL reverse the old attribution and apply only the net effects of the revised visit to the client, stock, and subscription quota

#### Scenario: Deleted attributed visit reverses all visit effects
- **WHEN** a delivery worker deletes a visit with subscription x20L attribution
- **THEN** the system SHALL reverse that attribution together with the visit's existing client and stock effects in one local mutation

#### Scenario: Local persistence fails
- **WHEN** an affected visit, client, stock, or subscription record cannot be committed to the local mutation
- **THEN** the system SHALL not make a partial local set of those effects visible and SHALL retain actionable retry feedback
