# Audit Logging

Every significant write operation in RouteSync produces an immutable audit log entry. The audit log is the authoritative record of who did what and when.

## What Gets Logged

| Event | Action string |
|---|---|
| Delivery created | `delivery.created` |
| Delivery assigned | `delivery.assigned` |
| Delivery reassigned | `delivery.reassigned` |
| Delivery status changed | `delivery.status_changed` |
| Proof of delivery submitted | `delivery.proof_submitted` |
| Delivery updated (notes, schedule) | `delivery.updated` |
| Driver created | `driver.created` |
| Driver updated | `driver.updated` |
| Vehicle created | `vehicle.created` |
| Vehicle status changed | `vehicle.status_changed` |
| Maintenance record created | `maintenance.created` |
| Route created | `route.created` |
| Route updated | `route.updated` |

## AuditLog Schema

```typescript
model AuditLog {
  id             String   // CUID
  organizationId String   // tenant scoping
  actorUserId    String   // who performed the action
  action         String   // e.g. "delivery.assigned"
  resourceType   String   // e.g. "Delivery"
  resourceId     String   // e.g. the delivery CUID
  metadata       Json?    // action-specific context (before/after values, failure reasons, etc.)
  requestId      String?  // optional correlation ID for distributed tracing
  createdAt      DateTime // immutable timestamp

  @@index([organizationId, createdAt(sort: Desc)])  // fast reverse-chronological listing
  @@index([resourceType, resourceId])               // fast per-resource history
}
```

## Transactional Guarantee

Audit entries are written inside the **same database transaction** as the mutation they record. If the mutation fails and rolls back, the audit entry rolls back with it. If the audit write fails, the mutation rolls back too.

This means the audit log is always consistent with the data — there is no window where a change exists in the database without an audit entry, and no audit entry exists for a change that was rolled back.

```typescript
// Example from the delivery assign endpoint
const delivery = await db.$transaction(async (tx) => {
  // ... validate, lock rows, ...

  const d = await tx.delivery.update({
    where: { id },
    data: { driverId, vehicleId, status: 'ASSIGNED' },
  })

  // Written in the same transaction — commits or rolls back together
  await createAuditLog({
    ctx,
    action: 'delivery.assigned',
    resourceType: 'Delivery',
    resourceId: id,
    metadata: { driverId, vehicleId, previousDriverId },
  }, tx)  // ← tx passed explicitly so the log shares the same connection

  return d
})
```

## The `createAuditLog` Function

`src/lib/audit.ts` exposes a single function:

```typescript
export async function createAuditLog(
  params: AuditParams,
  txClient?: typeof db,   // optional — pass the transaction client to write inside it
): Promise<void>
```

The `txClient` parameter is the key detail. When provided, the function uses the transaction's client (`tx`) rather than the global `db` singleton. Without it, Prisma would open a new connection for the audit insert — outside the transaction and unaffected by a rollback.

## Metadata

The `metadata` JSON field carries action-specific context:

```json
// delivery.assigned
{ "driverId": "...", "vehicleId": "...", "previousDriverId": null }

// delivery.status_changed
{ "from": "IN_TRANSIT", "to": "FAILED", "failureReason": "CUSTOMER_UNAVAILABLE" }

// delivery.created
{ "customerId": "...", "priority": "URGENT" }
```

This makes the audit log useful for answering questions like "what was this delivery's previous driver?" or "how many failures cited WRONG_ADDRESS this week?" without replaying mutation history.

## Immutability

Audit logs are only ever inserted — never updated or deleted. There are no `UPDATE` or `DELETE` operations on the `AuditLog` table in the codebase. In production, a database role with `INSERT`-only access to `AuditLog` can enforce this at the database level.

## Access Control

Only `OWNER` and `ADMIN` roles have the `audit.read` permission. The `GET /api/[orgSlug]/audit-logs` endpoint and the `/[orgSlug]/audit-logs` UI page both enforce this. The audit logs page additionally redirects non-admin users rather than rendering an empty list — avoiding the false impression that no events have occurred.

## Indexes

Two indexes on the `AuditLog` table serve the two main access patterns:

1. `[organizationId, createdAt DESC]` — powers the paginated audit log page (most recent first, scoped to tenant)
2. `[resourceType, resourceId]` — powers the per-delivery activity timeline on the delivery detail page

## Delivery Events

All status changes are logged with actor, timestamp, and previous state.

## Transition Audit

Every state change records from-state, to-state, actor, and timestamp.
