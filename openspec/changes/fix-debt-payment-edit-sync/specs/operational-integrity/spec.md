## MODIFIED Requirements

### Requirement: Visit effects persist atomically
The system SHALL persist a new or edited visit through the same all-or-nothing operation as its resulting client balance, returnable-container balances, and enabled delivery-worker stock adjustment. The visit form SHALL receive the operation result and treat the save as successful only when that result confirms success.

#### Scenario: New visit updates all affected records
- **WHEN** a delivery worker saves a valid new visit that changes client balances or enabled stock
- **THEN** the system SHALL make the visit, client, and stock changes visible together

#### Scenario: Edited visit replaces its previous effects
- **WHEN** a delivery worker saves changes to an existing visit
- **THEN** the system SHALL apply only the net difference between the old and new visit effects to the client and enabled stock

#### Scenario: Edited fiado is replaced by debt payment
- **WHEN** a delivery worker edits a visit that generated fiado to instead record a prior-debt payment through Mercado Pago
- **THEN** the system SHALL replace the fiado effect with the debt-payment effect in the customer's accumulated debt and confirm the save to the visit form

#### Scenario: Atomic persistence fails
- **WHEN** an affected record cannot be committed during a visit save
- **THEN** the system SHALL not persist a partial set of visit, client, or stock effects
