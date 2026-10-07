# Delivery State Machine

Every delivery in RouteSync progresses through a defined set of statuses. Arbitrary status changes are rejected — only transitions listed in the allowed-transitions table are accepted.

## Status Definitions

| Status | Meaning |
|---|---|
| `DRAFT` | Created but not yet submitted to the dispatch queue |
| `PENDING_DISPATCH` | Queued and awaiting driver and vehicle assignment |
| `ASSIGNED` | Driver and vehicle assigned; route not yet started |
| `IN_TRANSIT` | Driver has begun the route |
| `DELIVERED` | Successfully completed; terminal state |
| `FAILED` | Delivery attempt failed; eligible for re-dispatch |
| `CANCELLED` | Cancelled by a dispatcher; terminal state |

## Allowed Transitions

```
DRAFT ──────────────────► PENDING_DISPATCH
                                │
                                ├──────────────► CANCELLED
                                │
                                ▼
                           ASSIGNED ──────────► CANCELLED
                                │
                                ▼
                           IN_TRANSIT
                           │         │
                           ▼         ▼
                      DELIVERED    FAILED
                                     │
                                     └──► PENDING_DISPATCH  (re-dispatch)
```

Only these transitions are permitted. Any other transition (e.g. `DRAFT → IN_TRANSIT`, `DELIVERED → PENDING_DISPATCH`) is rejected with HTTP 422.

## Implementation

The transition table lives in `src/lib/delivery-state-machine.ts`:

```typescript
const ALLOWED_TRANSITIONS: [DeliveryStatus, DeliveryStatus][] = [
  ['DRAFT',             'PENDING_DISPATCH'],
  ['PENDING_DISPATCH',  'ASSIGNED'],
  ['ASSIGNED',          'IN_TRANSIT'],
  ['IN_TRANSIT',        'DELIVERED'],
  ['IN_TRANSIT',        'FAILED'],
  ['PENDING_DISPATCH',  'CANCELLED'],
  ['ASSIGNED',          'CANCELLED'],
  ['FAILED',            'PENDING_DISPATCH'],  // re-dispatch after failure
]
```

`assertValidTransition(from, to)` does an O(n) scan and throws `AppError` (HTTP 422, code `INVALID_TRANSITION`) if the pair is not in the table. With 8 entries, O(n) is negligible and avoids the complexity of a Map or Set.

The `POST /api/[orgSlug]/deliveries/[id]/status` endpoint calls `assertValidTransition` before touching the database — a delivery is never persisted in an invalid state.

## Who Triggers Which Transition

| Transition | Triggered by |
|---|---|
| `DRAFT → PENDING_DISPATCH` | Admin/Dispatcher (submitting the order) |
| `PENDING_DISPATCH → ASSIGNED` | Dispatcher (via the assign endpoint, not the status endpoint) |
| `ASSIGNED → IN_TRANSIT` | Driver (starting the route from the driver interface) |
| `IN_TRANSIT → DELIVERED` | Driver (via proof-of-delivery submission) |
| `IN_TRANSIT → FAILED` | Driver (reporting a failure with a reason code) |
| `PENDING_DISPATCH → CANCELLED` | Admin/Dispatcher |
| `ASSIGNED → CANCELLED` | Admin/Dispatcher (before the driver departs) |
| `FAILED → PENDING_DISPATCH` | Dispatcher (re-queuing for a retry) |

## Failure Reasons

When a driver marks a delivery as `FAILED`, a `failureReason` is required:

```typescript
enum FailureReason {
  CUSTOMER_UNAVAILABLE
  WRONG_ADDRESS
  DAMAGED_PACKAGE
  REFUSED_DELIVERY
  VEHICLE_ISSUE
  OTHER
}
```

The `failureNote` field (free text) is optional for most reasons but expected when `OTHER` is selected. Both values are persisted on the `Delivery` row and included in the audit log for dispatcher review.

## Address Snapshots

Delivery addresses are stored as JSON snapshots at creation time, not as foreign keys to live `CustomerAddress` rows:

```typescript
await db.delivery.create({
  data: {
    pickupAddress:   { street, city, state, postalCode, country },  // snapshot
    deliveryAddress: { street, city, state, postalCode, country },  // snapshot
    ...
  },
})
```

If a customer later updates their address, historical deliveries retain the address that was current at dispatch time — important for proof-of-delivery accuracy and dispute resolution.

## Testing

The state machine has a dedicated unit test suite in `src/__tests__/delivery-state-machine.test.ts` covering:

- All 8 allowed transitions (must not throw)
- Invalid transitions including backwards steps, terminal-state escapes, and skipped steps
- `getAvailableTransitions()` output for each status
- Empty transition list for terminal states (`DELIVERED`, `CANCELLED`)

## Transitions

DRAFT→PENDING→ASSIGNED→IN_TRANSIT→DELIVERED | FAILED

## Assignment

Dispatchers assign deliveries to available drivers via the dispatch API.

## Route Planning

Routes are optimised for distance within time window constraints.
