## Purpose

Ensure each delivery visit produces valid commercial data and leaves its related operational records consistent when it is saved.

## ADDED Requirements

### Requirement: Valid sales require products and value
The system SHALL reject a visit marked as a sale unless it contains at least one line item with a positive quantity and its calculated total is greater than zero.

#### Scenario: Sale without products is rejected
- **WHEN** a delivery worker saves a visit marked as a sale with no line item whose quantity is positive
- **THEN** the system SHALL keep the visit form open and show a validation error

#### Scenario: Sale with zero total is rejected
- **WHEN** a delivery worker saves a visit marked as a sale whose calculated total is zero
- **THEN** the system SHALL keep the visit form open and show a validation error

#### Scenario: Valid sale is accepted for persistence
- **WHEN** a delivery worker saves a sale with a positive-quantity line item and a positive calculated total
- **THEN** the system SHALL submit the visit for persistence

### Requirement: Visit effects persist atomically
The system SHALL persist a new or edited visit together with its resulting client balance, returnable-container balances, and enabled delivery-worker stock adjustment as one all-or-nothing operation.

#### Scenario: New visit updates all affected records
- **WHEN** a delivery worker saves a valid new visit that changes client balances or enabled stock
- **THEN** the system SHALL make the visit, client, and stock changes visible together

#### Scenario: Edited visit replaces its previous effects
- **WHEN** a delivery worker saves changes to an existing visit
- **THEN** the system SHALL apply only the net difference between the old and new visit effects to the client and enabled stock

#### Scenario: Atomic persistence fails
- **WHEN** an affected record cannot be committed during a visit save
- **THEN** the system SHALL not persist a partial set of visit, client, or stock effects

### Requirement: Persistence failures are actionable
The system SHALL inform the delivery worker when a visit cannot be persisted and SHALL retain the entered visit data for retry or correction.

#### Scenario: Save error is displayed
- **WHEN** persistence of a visit fails
- **THEN** the system SHALL keep the form open and display an error that saving did not complete

#### Scenario: Successful save closes the form
- **WHEN** all affected visit records persist successfully
- **THEN** the system SHALL close the form and show the saved visit in the operational data
