## MODIFIED Requirements

### Requirement: Integrity behavior is covered by automated and manual offline verification
The test suite SHALL cover the sale-validity rules, visible and recoverable form-save failures, coherent local mutation of affected visit records, the valid fiado sale of one x20 bidon, and the debt effect of replacing an edited fiado visit with a prior-debt payment through Mercado Pago. Manual verification SHALL cover offline local saving and synchronization after reconnecting without a server transaction.

#### Scenario: Invalid sale test coverage
- **WHEN** the test suite evaluates sales with no positive-quantity product or with a zero total
- **THEN** it SHALL verify that each sale is rejected

#### Scenario: Local-mutation failure test coverage
- **WHEN** the test suite simulates a failure while applying an affected visit record locally
- **THEN** it SHALL verify that no partial local operation is reported as saved, the failure is surfaced beside the save control, and the form can be submitted again

#### Scenario: Thrown save callback test coverage
- **WHEN** the test suite simulates a save callback that throws
- **THEN** it SHALL verify that pending submit state is cleared, entered data is retained, and a retryable error is displayed beside the save control

#### Scenario: Connection feedback test coverage
- **WHEN** the test suite simulates an offline or connection persistence failure
- **THEN** it SHALL verify that the displayed save error tells the worker to check their connection before retrying

#### Scenario: Valid x20 fiado sale regression coverage
- **WHEN** the test suite submits a sale with one positive-quantity x20 bidon marked fiado and a valid total
- **THEN** it SHALL verify that validation accepts the sale and invokes the save path

#### Scenario: Fiado replacement regression coverage
- **WHEN** the test suite starts with $1500 customer debt including a persisted $500 fiado visit and edits it into a $1000 prior-debt payment through Mercado Pago
- **THEN** it SHALL verify the local mutation replaces the visit and customer state, `deudaAcumulada` is $0, and the dashboard's "Plata en la calle" total is $0

#### Scenario: Offline and reconnect verification coverage
- **WHEN** a tester saves the fiado-replacement edit while offline and reconnects the device afterwards
- **THEN** the tester SHALL verify the local visit, customer debt, and dashboard total immediately, then verify synchronization completes without using a server transaction
