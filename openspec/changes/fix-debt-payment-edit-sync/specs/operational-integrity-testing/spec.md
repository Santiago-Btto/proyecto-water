## MODIFIED Requirements

### Requirement: Integrity behavior is covered by automated tests
The automated test suite SHALL cover the sale-validity rules, the all-or-nothing handling of affected visit records, and the debt effect of replacing an edited fiado visit with a prior-debt payment through Mercado Pago.

#### Scenario: Invalid sale test coverage
- **WHEN** the test suite evaluates sales with no positive-quantity product or with a zero total
- **THEN** it SHALL verify that each sale is rejected

#### Scenario: Atomic-operation failure test coverage
- **WHEN** the test suite simulates a failure while persisting an affected visit record
- **THEN** it SHALL verify that no partial operation is reported as saved and that the failure is surfaced

#### Scenario: Fiado replacement regression coverage
- **WHEN** the test suite edits a persisted fiado visit into a visit that records a prior-debt payment through Mercado Pago
- **THEN** it SHALL verify the resulting accumulated debt no longer includes the replaced fiado and includes the debt payment deduction
