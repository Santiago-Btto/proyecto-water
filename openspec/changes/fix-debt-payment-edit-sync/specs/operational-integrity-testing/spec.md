## MODIFIED Requirements

### Requirement: Integrity behavior is covered by automated tests
The automated test suite SHALL cover the sale-validity rules, visible and recoverable form-save failures, the all-or-nothing handling of affected visit records, the valid fiado sale of one x20 bidon, and the debt effect of replacing an edited fiado visit with a prior-debt payment through Mercado Pago.

#### Scenario: Invalid sale test coverage
- **WHEN** the test suite evaluates sales with no positive-quantity product or with a zero total
- **THEN** it SHALL verify that each sale is rejected

#### Scenario: Atomic-operation failure test coverage
- **WHEN** the test suite simulates a failure while persisting an affected visit record
- **THEN** it SHALL verify that no partial operation is reported as saved, the failure is surfaced beside the save control, and the form can be submitted again

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
- **WHEN** the test suite edits a persisted fiado visit into a visit that records a prior-debt payment through Mercado Pago
- **THEN** it SHALL verify the resulting accumulated debt no longer includes the replaced fiado and includes the debt payment deduction
