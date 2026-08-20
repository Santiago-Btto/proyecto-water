## MODIFIED Requirements

### Requirement: Visit effects persist coherently in the offline-first local cache
The system SHALL save a new or edited visit through one `mutate` operation that updates the visit and its resulting client balance, returnable-container balances, and enabled delivery-worker stock adjustment in the persistent local cache. The delivery save path SHALL NOT use Firestore `runTransaction`. The visit form SHALL receive the local save result and treat the save as successful only when that result confirms success. The form SHALL recover its submit state when the save callback returns a failed result or throws, retain entered data on failure, and display validation and persistence errors adjacent to its sticky "Guardar visita" button.

#### Scenario: New visit updates all affected local records
- **WHEN** a delivery worker saves a valid new visit that changes client balances or enabled stock
- **THEN** the system SHALL make the visit, client, and stock changes visible together in the persistent local cache

#### Scenario: Edited visit replaces its previous effects
- **WHEN** a delivery worker saves changes to an existing visit
- **THEN** the system SHALL apply only the net difference between the old and new visit effects to the client and enabled stock in the same local mutation

#### Scenario: Edited fiado is replaced by debt payment
- **WHEN** a customer with $1500 accumulated debt has a persisted $500 fiado visit edited to record a $1000 prior-debt payment through Mercado Pago
- **THEN** the same local mutation SHALL replace the visit and customer effects, leave `deudaAcumulada` at $0, make "Plata en la calle" $0, and confirm the save to the visit form

#### Scenario: Local save cannot be applied
- **WHEN** an affected record cannot be applied during a visit's local mutation
- **THEN** the system SHALL not report a partial local set of visit, client, or stock effects as saved and SHALL show a retryable persistence error next to "Guardar visita"

#### Scenario: Save callback throws
- **WHEN** the visit form's save callback throws while a save is pending
- **THEN** the form SHALL clear its pending state, retain the entered visit, and show a retryable persistence error next to "Guardar visita"

#### Scenario: Connection failure is actionable
- **WHEN** a visit save is queued in the persistent local cache while the device is offline, or the local save cannot be queued
- **THEN** the form SHALL retain visible pending or retryable feedback next to "Guardar visita" and SHALL tell the worker to check the connection before retrying when the save cannot be queued

#### Scenario: Queued offline save synchronizes after reconnecting
- **WHEN** a worker saves an edited visit while offline and later reconnects
- **THEN** the locally visible visit, customer debt, and "Plata en la calle" result SHALL remain coherent and the queued save SHALL synchronize without requiring a server transaction

#### Scenario: Invalid sale remains visible
- **WHEN** a worker attempts to save a sale rejected by the existing sale-validity rules
- **THEN** the form SHALL retain the entered visit and show the validation reason next to "Guardar visita" without attempting persistence

#### Scenario: One x20 bidon sold fiado is valid
- **WHEN** a worker records a sale with one positive-quantity x20 bidon marked fiado and a valid resulting total
- **THEN** the system SHALL accept the sale validation and proceed with its normal save path
