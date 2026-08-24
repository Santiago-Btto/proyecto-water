## Purpose

Gestionar suscripciones mensuales de bidones x20L para clientes con maquina de frio/calor, manteniendo cupos, precios, cobros y vencimientos auditables.

## ADDED Requirements

### Requirement: Eligible monthly promotions are administered by an administrator
The system SHALL allow an administrator to create, update, activate, and deactivate monthly promotions only for `maquinaFrioCalor`. Each active promotion MUST have exactly 4, 6, 8, or 10 x20L bidones and a positive configurable total monthly price that includes machine rental.

#### Scenario: Administrator configures a valid promotion
- **WHEN** an administrator saves an active 6 x20L promotion with a positive total monthly price
- **THEN** the promotion SHALL be available for eligible customer selection with its configured quota and total price

#### Scenario: Administrator attempts an unsupported quota
- **WHEN** an administrator saves a promotion with a quota other than 4, 6, 8, or 10 x20L bidones
- **THEN** the system SHALL reject the promotion and SHALL not make it available for selection

### Requirement: Only eligible clients can start a monthly subscription during the selection window
The system SHALL allow a client with `maquinaFrioCalor` to select one active promotion from day 1 through day 10 of a calendar month. The system MUST create one durable subscription for that client and period with snapshots of the selected promotion name, quota, total price, and selection date. Clients without `maquinaFrioCalor` MUST NOT be offered or assigned a subscription.

#### Scenario: Eligible client selects on day 10
- **WHEN** a client with `maquinaFrioCalor` selects an active promotion on the 10th day of a month
- **THEN** the system SHALL create the subscription for that month using the promotion values at selection time

#### Scenario: Selection outside the monthly window is rejected
- **WHEN** an eligible client attempts to select a promotion before day 1, after day 10, or after already selecting one for that month
- **THEN** the system SHALL reject the selection and preserve the existing monthly subscription unchanged

#### Scenario: Ineligible client is not subscribed
- **WHEN** an administrator or delivery worker opens subscription selection for a client without `maquinaFrioCalor`
- **THEN** the system SHALL not offer promotions or create a subscription for that client

### Requirement: A monthly subscription is immutable in commercial terms
The system SHALL preserve a subscription's promotion, quota, and total monthly price snapshots after creation. The customer MUST NOT change promotion during the subscribed month; later promotion price or activation changes MUST NOT change an existing subscription.

#### Scenario: Promotion price changes after subscription creation
- **WHEN** an administrator changes the current price of a promotion after a customer subscribed
- **THEN** the existing subscription SHALL retain its original total monthly price and quota

#### Scenario: Customer requests a mid-month promotion change
- **WHEN** a customer with a subscription attempts to select a different promotion in the same month
- **THEN** the system SHALL reject the change and retain the original subscription

### Requirement: Subscription payment and period eligibility are controlled independently of ordinary sales debt
The system SHALL record one total payment against a subscription using an existing payment method and mark it paid when the full snapped total is received. A subscription remains payable through day 15, becomes overdue from day 16 while unpaid, and an unpaid overdue subscription MUST block enabling a later monthly subscription for that client. Subscription payment status and totals MUST remain separate from ordinary visit-sale debt and debt-payment metrics.

#### Scenario: Delivery begins before payment
- **WHEN** a subscribed customer receives x20L bidones before paying the monthly total
- **THEN** the system SHALL retain the subscription as unpaid and allow quota delivery subject to its remaining quota

#### Scenario: Subscription becomes overdue
- **WHEN** an unpaid subscription is evaluated on day 16
- **THEN** the system SHALL mark it overdue and SHALL prevent a later period from being enabled for that client until the subscription is paid

#### Scenario: Existing payment method settles the subscription
- **WHEN** an administrator records the full snapped subscription total with an existing payment method
- **THEN** the subscription SHALL be marked paid with that method and later-period eligibility SHALL no longer be blocked by it

### Requirement: x20L deliveries consume subscription quota before individual sales
The system SHALL attribute each delivered x20L bidon within a subscribed customer's remaining monthly quota to that subscription and show the delivery worker the quota, consumed quantity, remaining quantity, and excess quantity before saving. Any x20L quantity above the remaining quota MUST be recorded through the existing individual-sale flow at the current normal unit price, not at the subscription snapshot price.

#### Scenario: Delivery fits the remaining quota
- **WHEN** a delivery worker records 2 x20L bidones for a subscription with 3 remaining
- **THEN** the visit SHALL attribute 2 bidones to the subscription, leave 1 remaining, and create no individual x20L sale for those bidones

#### Scenario: Delivery exceeds the remaining quota
- **WHEN** a delivery worker records 3 x20L bidones for a subscription with 1 remaining
- **THEN** the visit SHALL attribute 1 bidon to the subscription and record 2 bidones as an individual sale at the current normal unit price

### Requirement: Subscription delivery attribution is reversible with visit changes
The system SHALL retain the subscription attribution on each visit and SHALL recompute the affected subscription quota when an attributed visit is edited or deleted. Reversal MUST restore only the previously attributed x20L quantity and MUST preserve the ordinary sale, debt, and stock effects that apply to the revised visit.

#### Scenario: Attributed visit is edited to reduce x20L delivery
- **WHEN** a visit attributed with 2 subscription x20L bidones is edited to attribute 1
- **THEN** the subscription SHALL regain 1 unit of remaining quota and the revised visit effects SHALL be applied

#### Scenario: Attributed visit is deleted
- **WHEN** a visit attributed with subscription x20L bidones is deleted
- **THEN** the subscription SHALL regain its attributed quantity and no longer count that visit toward consumed quota

### Requirement: Subscription summaries and legacy clients remain operationally clear
The system SHALL show a subscription summary for eligible clients that identifies the current period, payment state, quota consumption, remaining quota, and overdue status. Existing clients with `maquinaFrioCalor` and no subscription MUST remain deliverable through the ordinary sale flow and SHALL be identified as having no subscription. Subscription totals and status counts MUST be reported separately from existing sales, debt, and stock metrics.

#### Scenario: Existing eligible client has no migrated subscription
- **WHEN** a pre-existing client with `maquinaFrioCalor` has no monthly subscription record
- **THEN** the system SHALL show no subscription for the period and SHALL continue to allow ordinary individual sales

#### Scenario: Operational summary is viewed
- **WHEN** an administrator views operational metrics
- **THEN** the system SHALL present subscription paid, unpaid, overdue, and quota summary values separately from ordinary sales, debt, and stock metrics
