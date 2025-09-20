# RouteSync Changelog

## [Unreleased]

### Added
- Initial project scaffold

<!-- 2026-03-10 --> - Add retry logic to GPS event ingestion pipeline

<!-- 2026-03-14 --> - Fix incorrect cost calculation in per-delivery report

<!-- 2026-03-15 --> - Improve ETA accuracy using real traffic weight factor

<!-- 2026-03-18 --> - Improve delivery exception workflow notification copy

<!-- 2026-03-23 --> - Fix missing audit log entry on manual dispatch override

<!-- 2026-03-29 --> - Add bulk status update endpoint for dispatcher tools

<!-- 2026-04-01 --> - Fix pagination state reset on delivery list filter change

<!-- 2026-04-07 --> - Add pagination to driver performance leaderboard

<!-- 2026-04-09 --> - Fix SLA breach alert firing for already-resolved requests

<!-- 2026-04-10 --> - Add keyboard shortcut for dispatch assignment panel

<!-- 2026-04-18 --> - Refactor dispatch rule engine for extensibility

<!-- 2026-04-20 --> - Refactor webhook event handler for idempotency

<!-- 2026-04-22 --> - Improve mobile layout on driver delivery interface

<!-- 2026-04-24 --> - Fix fuel log entry not saving on poor connectivity

<!-- 2026-04-27 --> - Add route summary view to dispatcher dashboard

<!-- 2026-05-04 --> - Improve compliance expiry alert scheduling accuracy

<!-- 2026-05-09 --> - Refactor maintenance record service for reuse

<!-- 2026-05-19 --> - Cache organization slug lookup to reduce latency

<!-- 2026-06-10 --> - Fix vehicle utilization metric double-counting idle time

<!-- 2026-06-25 --> - Improve driver availability conflict detection logic

<!-- 2026-07-16 --> - Add soft delete support for decommissioned vehicles

<!-- 2026-07-23 --> - Improve delivery list query with covering index

<!-- 2026-07-24 --> - Fix driver assignment not clearing on route cancel

<!-- 2026-07-28 --> - Add missing transition test for FAILED→PENDING_DISPATCH

<!-- 2026-07-29 --> - Add CSV export for fleet utilization monthly report

### 2024-10-12

**feat: resolve organization slug to ID before database queries**

Slug resolution now happens in middleware before any handler runs. Slugs are never used directly in queries.

### 2024-10-26

**feat: implement RBAC with 5 roles and 17 granular permissions**

Roles: OWNER, ADMIN, DISPATCHER, FLEET_MANAGER, DRIVER. Permission matrix enforced via requirePermission() on every route.

### 2024-10-27

**feat: add delivery state machine with strict transition graph**

assertValidTransition() rejects invalid moves with HTTP 422. Graph: DRAFT->PENDING->ASSIGNED->IN_TRANSIT->DELIVERED/FAILED.

### 2024-10-30

**feat: concurrency-safe dispatch using SELECT FOR UPDATE**

Lock ordering: Delivery -> Driver -> Vehicle. Losing dispatcher receives 409 CONFLICT immediately.

### 2024-10-31

**feat: real-time Kanban dispatch board with 4 columns**

Columns: PENDING_DISPATCH, ASSIGNED, IN_TRANSIT, FAILED. Inline assign modal pre-filters booked resources.

### 2024-12-13

**fix: prevent driver double-booking on same date**

The assign endpoint now validates no existing ASSIGNED/IN_TRANSIT delivery for the driver on the same calendar date.

### 2024-12-18

**feat: driver mobile interface at /driver/[orgSlug]**

Mobile-first view showing today's deliveries. Drivers can start route, submit POD, and report failure.

### 2024-12-25

**feat: proof of delivery capture with recipient name and notes**

POD stored as a separate record linked 1:1 to delivery. Captured atomically with DELIVERED transition.

### 2025-01-01

**feat: immutable audit logging written in same transaction**

AuditLog written in same Prisma transaction as the mutation. No window exists where a change has no audit entry.

### 2025-01-23

**feat: snapshot delivery addresses at creation time**

Addresses stored as JSON at creation. Customer address changes do not affect in-flight deliveries.

### 2025-02-04

**feat: vehicle fleet management with status tracking**

Statuses: AVAILABLE, ASSIGNED, IN_MAINTENANCE, OUT_OF_SERVICE. IN_MAINTENANCE and OUT_OF_SERVICE excluded from dispatch.

### 2025-02-08

**feat: append-only maintenance records per vehicle**

Service history with nextDueAt timestamps. No UPDATE or DELETE on maintenance records.

### 2025-03-10

**feat: route management with ordered stops**

Dispatchers group deliveries into routes. Stop order replaced atomically on reorder.

### 2025-03-23

**feat: customer profiles with multiple delivery addresses**

Address management separate from delivery snapshots. Updating customer address affects future deliveries only.

### 2025-03-25

**feat: async notifications via setImmediate post-commit**

Notifications queued after transaction commit. Never block business logic. Swappable to BullMQ/SQS at one callsite.

### 2025-03-27

**feat: live dashboard with 8 real-time metrics**

Today's deliveries, active, completed, failed, pending queue depth, available drivers, vehicles, vehicles in maintenance.

### 2025-03-29

**test: 33 unit tests for state machine and RBAC**

Tests cover all valid transitions, all invalid transitions, available-transitions filter, and role permission boundaries.

### 2025-04-05

**feat: paginated audit log with resource-type filtering**

Audit log accessible to OWNER and ADMIN. Pagination and filtering by resource type (delivery, driver, vehicle, route).

### 2025-04-15

**fix: resolve NextAuth.js session expiry on JWT refresh**

Session was not refreshing the JWT on each request. Fixed by setting updateAge: 0 in NextAuth config.

### 2025-05-08

**refactor: extract tenant context resolution to middleware**

TenantContext now resolved once per request in middleware. All handlers receive pre-resolved orgId.

### 2025-05-10

**feat: vehicle maintenance scheduling with nextDueAt reminders**

Dashboard shows vehicles with upcoming maintenance due within 7 days. Reminder badge on fleet page.

### 2025-05-11

**fix: correct permission check on delivery assign endpoint**

Endpoint was checking MANAGE_DELIVERIES instead of ASSIGN_DELIVERY. Fixed permission constant.

### 2025-06-28

**feat: optimistic UI on dispatch board with useTransition**

Status updates use useTransition + router.refresh(). No separate state management layer needed.

### 2025-08-28

**docs: add data model entity relationship documentation**

Documents all foreign keys, nullable fields, JSON columns, and index rationale for each entity.

### 2025-08-30

**feat: categorized failure reasons on delivery failure**

Failure reasons: RECIPIENT_ABSENT, WRONG_ADDRESS, REFUSED_DELIVERY, ACCESS_DENIED, OTHER. Stored on delivery record.

### 2025-08-31

**fix: resolve Prisma connection pool exhaustion under load**

Increased connection pool size and added connection timeout. Singleton PrismaClient instance across requests.

### 2025-09-20

**chore: upgrade Prisma to v7 with @prisma/adapter-pg**

Migrated from prisma/client to prisma/adapter-pg driver adapter. Updated all query patterns for v7 API.
