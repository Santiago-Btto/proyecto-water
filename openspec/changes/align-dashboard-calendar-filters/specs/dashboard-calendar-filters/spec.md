## Purpose

Ensure administrator dashboard date filters consistently report local calendar periods rather than rolling elapsed-date windows.

## ADDED Requirements

### Requirement: Week filter uses the current Sunday-to-Saturday calendar week
When the administrator selects the Week filter, the dashboard SHALL include visits and expenses dated from the Sunday beginning the current local calendar week through the following Saturday, inclusive.

#### Scenario: Sunday starts a new dashboard week
- **WHEN** the current local date is a Sunday and a record is dated that Sunday
- **THEN** the Week filter includes the record and excludes records dated on the preceding Saturday

#### Scenario: Saturday remains in the current dashboard week
- **WHEN** the current local date is a Saturday and records are dated on that week's Sunday and Saturday
- **THEN** the Week filter includes both records and excludes a record dated on the following Sunday

#### Scenario: Week filter applies equally to visits and expenses
- **WHEN** visits and expenses have dates inside and outside the current calendar week
- **THEN** every dashboard total and list that uses the Week filter is calculated only from the in-week records

### Requirement: Month filter uses the current calendar month
When the administrator selects the Month filter, the dashboard SHALL include only visits and expenses dated in the current local calendar month, beginning on its first day and ending on its last day.

#### Scenario: Month filter includes the final day of the month
- **WHEN** the current local date is the final day of a month and a record is dated that day
- **THEN** the Month filter includes the record and excludes a record from the preceding month

#### Scenario: Month filter resets on the first day of a new month
- **WHEN** the current local date is the first day of a month and records exist for that day and the prior month's final day
- **THEN** the Month filter includes the current-day record and excludes the prior-month record
