# Notifications

Notifications are delivered asynchronously using a fire-and-forget pattern. The core business transaction never waits for notification delivery — notification failures cannot cause business logic to fail.

## Design Principle

A delivery assignment succeeding must not depend on a notification being sent. These are different reliability domains. The transaction commits, the HTTP response is sent to the client, and then notifications are processed in the background.

## Implementation

`src/lib/notifications.ts` exposes a single function:

```typescript
export function queueNotification(params: NotifyParams): void {
  setImmediate(async () => {
    try {
      await db.notification.create({ data: params })
    } catch (err) {
      console.error('[notification] Failed to create notification:', err)
    }
  })
}
```

`setImmediate` schedules the callback after the current event loop iteration completes — which means after the HTTP response has been flushed to the client. The notification write is best-effort: if it fails, the error is logged and the application continues normally.

### Why `setImmediate` and Not a Queue

For an MVP, a full message queue (Redis + BullMQ, SQS, etc.) adds infrastructure complexity without proportional benefit. `setImmediate` gives us:

- Post-commit fire-and-forget semantics (the important property)
- Zero infrastructure dependencies
- Easy to replace: change `queueNotification` to push to a real queue later; all callers stay the same

The abstraction is already in place — callers never import `setImmediate` directly. Swapping the implementation requires touching one file.

### The One Limitation

If the Node.js process restarts between the `db.$transaction` commit and the `setImmediate` execution, the notification is lost. For a production system, this is addressed by moving to a persistent queue (pg-based job queue or Redis). The current implementation is acceptable for MVP because:

- Notifications are a best-effort UX feature, not a business-critical flow
- The underlying data (delivery status, audit log) is always consistent regardless of notification delivery

## Events That Trigger Notifications

| Event | Recipients | Type |
|---|---|---|
| Delivery assigned to driver | The driver's user account | `DELIVERY_ASSIGNED` |
| Delivery reassigned (different driver) | The new driver | `DELIVERY_REASSIGNED` |
| Delivery marked as FAILED | All OWNER, ADMIN, DISPATCHER members | `DELIVERY_FAILED` |
| Maintenance record created with `nextDueAt` | All FLEET_MANAGER, ADMIN, OWNER members | `MAINTENANCE_DUE` |

## Notification Schema

```typescript
model Notification {
  id             String           // CUID
  organizationId String           // tenant scoping
  userId         String           // recipient
  type           NotificationType // enum
  title          String           // short headline
  body           String           // full message
  resourceType   String?          // e.g. "Delivery"
  resourceId     String?          // e.g. the delivery ID
  read           Boolean          // default false
  createdAt      DateTime
}
```

## API Surface

```
GET  /api/[orgSlug]/notifications    → returns unread notifications for the current user
PATCH /api/[orgSlug]/notifications   → marks all notifications as read
```

The PATCH endpoint is a bulk "mark all read" operation — suitable for a notification bell dropdown that clears on open.

## Where Notifications Are Triggered in Code

Notifications are always triggered **after** the `db.$transaction` block returns, not inside it:

```typescript
// Inside the route handler, after the transaction commits:
const result = await db.$transaction(async (tx) => {
  // ... assign delivery, write audit log ...
  return { updated, driverUserId }
})

// Transaction is committed. Now fire notifications — outside the transaction.
if (result.driverUserId) {
  queueNotification({
    organizationId: org.id,
    userId: result.driverUserId,
    type: 'DELIVERY_ASSIGNED',
    title: 'New Delivery Assigned',
    body: `You have been assigned delivery ${id.slice(-8)}`,
    resourceType: 'Delivery',
    resourceId: id,
  })
}
```

Calling `queueNotification` inside a transaction would mean the notification write shares the transaction's connection and is subject to rollback — defeating the purpose. It would also hold the transaction open longer than necessary.

## ETA Service

ETA recalculated on each status update using current position.
