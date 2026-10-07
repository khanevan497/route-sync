# Dispatch Concurrency

This is the highest-stakes correctness requirement in the codebase. Two dispatchers working simultaneously must not be able to assign the same driver or vehicle to conflicting deliveries. A naive implementation — read availability, then write assignment — has a time-of-check/time-of-use (TOCTOU) race condition.

## The Problem

```
Dispatcher A                          Dispatcher B
─────────────────────────────────────────────────────────
1. Read: Driver X is ACTIVE ──────►  1. Read: Driver X is ACTIVE
2.                                   2. Assign Driver X to Delivery 2 ✓
3. Assign Driver X to Delivery 1 ✓  ← both succeed — Driver X double-booked!
```

If availability is checked and the assignment is written in two separate database operations, there is a window between step 1 and step 3 where another request can slip in.

## The Solution: Pessimistic Locking

The `POST /api/[orgSlug]/deliveries/[id]/assign` endpoint uses `SELECT ... FOR UPDATE` inside a `db.$transaction()`. This acquires an exclusive row-level lock on each relevant row before reading it. Any other transaction attempting to lock the same row will block until this transaction commits or rolls back.

```typescript
const result = await db.$transaction(async (tx) => {

  // Lock the delivery row — no other transaction can modify it until we commit
  const [delivery] = await tx.$queryRaw<...>`
    SELECT id, status, "organizationId"
    FROM "Delivery"
    WHERE id = ${id}
    FOR UPDATE
  `

  // Lock the driver row
  const [driver] = await tx.$queryRaw<...>`
    SELECT id, status, "organizationId"
    FROM "Driver"
    WHERE id = ${driverId}
    FOR UPDATE
  `

  // Lock the vehicle row
  const [vehicle] = await tx.$queryRaw<...>`
    SELECT id, status, "organizationId"
    FROM "Vehicle"
    WHERE id = ${vehicleId}
    FOR UPDATE
  `

  // --- All three rows are now locked ---

  // Validate: delivery must be dispatchable
  if (!['PENDING_DISPATCH', 'FAILED'].includes(delivery.status))
    throw new ConflictError(...)

  // Validate: driver must be active and belong to this tenant
  if (driver.status !== 'ACTIVE') throw new ConflictError(...)

  // Validate: vehicle must not be in maintenance or out of service
  if (['IN_MAINTENANCE', 'OUT_OF_SERVICE'].includes(vehicle.status))
    throw new ConflictError(...)

  // Validate: no conflicting same-day assignment
  const conflictingDriver = await tx.delivery.findFirst({
    where: {
      driverId,
      organizationId: org.id,
      status: { in: ['ASSIGNED', 'IN_TRANSIT'] },
      scheduledDate: { gte: startOfDay, lte: endOfDay },
      id: { not: id },
    },
  })
  if (conflictingDriver) throw new ConflictError('Driver already assigned...')

  // Write the assignment — safe because we hold all three locks
  const updated = await tx.delivery.update({
    where: { id },
    data: { driverId, vehicleId, status: 'ASSIGNED' },
  })

  // Audit log written inside the same transaction — it either all commits or all rolls back
  await createAuditLog({ ctx, action: 'delivery.assigned', ... }, tx)

  return updated
})
// Transaction commits → locks released
```

### What Happens When Dispatcher B Arrives Mid-Transaction

```
Dispatcher A                              Dispatcher B
─────────────────────────────────────────────────────────────────────
BEGIN TRANSACTION
  SELECT Driver X FOR UPDATE ──────────►  BEGIN TRANSACTION
    (lock acquired)                          SELECT Driver X FOR UPDATE
                                             (BLOCKED — waits for A's lock)
  validate → pass
  assign Driver X → Delivery 1
  audit log written
COMMIT ──────────────────────────────────►  Lock released
                                             SELECT Driver X returns → status is now ASSIGNED
                                             validate → fail (already conflicting)
                                          ROLLBACK → returns 409 CONFLICT to Dispatcher B
```

Dispatcher B gets a `409 CONFLICT` with a clear error message. Their UI shows the error and they select a different driver or vehicle.

## Why Raw SQL for the Locks

Prisma's `findFirst` and `findUnique` do not expose `SELECT ... FOR UPDATE` directly (as of Prisma 7). Using `tx.$queryRaw` with tagged template literals gives us the locking semantics while keeping the rest of the transaction in Prisma's type-safe API. The parameterised template prevents SQL injection — values are passed as parameters, not string-interpolated.

## Conflict Detection Scope

The conflict check looks at the **scheduled date** of the delivery being assigned. A driver is considered conflicted if they already have an `ASSIGNED` or `IN_TRANSIT` delivery on the same calendar day. This is a conservative rule — in a future version it could be tightened to time windows.

If the delivery has no `scheduledDate`, the conflict check is skipped (unscheduled deliveries are assumed to be flexible).

## Lock Ordering

All three lock acquisitions follow a consistent order: **Delivery → Driver → Vehicle**. Consistent lock ordering prevents deadlocks — two transactions cannot deadlock on these rows because they always request the locks in the same sequence.

## Auto-Assignment

Matches deliveries to drivers by zone, capacity, and availability.
