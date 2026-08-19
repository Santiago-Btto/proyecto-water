## Purpose

Provide repeatable automated verification for the operational rules that protect delivery sales and related Firestore updates.

## ADDED Requirements

### Requirement: Automated test command
The project SHALL provide a documented package command that executes its automated tests without launching the development server.

#### Scenario: Tests run from the project root
- **WHEN** a developer runs the project test command
- **THEN** the automated test suite SHALL execute and return a failing exit status when a test fails

### Requirement: Integrity behavior is covered by automated tests
The automated test suite SHALL cover the sale-validity rules and the all-or-nothing handling of affected visit records.

#### Scenario: Invalid sale test coverage
- **WHEN** the test suite evaluates sales with no positive-quantity product or with a zero total
- **THEN** it SHALL verify that each sale is rejected

#### Scenario: Atomic-operation failure test coverage
- **WHEN** the test suite simulates a failure while persisting an affected visit record
- **THEN** it SHALL verify that no partial operation is reported as saved and that the failure is surfaced
