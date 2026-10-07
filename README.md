# RouteSync

A multi-tenant logistics and fleet operations platform built with Next.js, Prisma 7, and PostgreSQL. Built for logistics operators who need to coordinate drivers, vehicles, deliveries, and routes across independent organisations from one place.

---

## Key Features

### Multi-Tenancy
Every record in the database is scoped to an `Organization`. URL slugs are resolved to organisation IDs before any database query executes — slugs are never trusted directly. A single user account can hold different roles in different organisations via the `Membership` join table. Tenant isolation is enforced at the application layer on every request and is designed to support PostgreSQL row-level security as a defence-in-depth layer.

### Role-Based Access Control (RBAC)
Five roles with 17 granular permissions, verified on every API route handler via `requirePermission()`:

| Role | Key Capabilities |
|---|---|
| `OWNER` | Full access including org settings and audit logs |
| `ADMIN` | Same as OWNER minus organisation management |
| `DISPATCHER` | Full delivery lifecycle, read access to drivers and vehicles |
| `FLEET_MANAGER` | Vehicle and maintenance management, read-only on drivers |
| `DRIVER` | Read own deliveries, update delivery status |

The full permission matrix is in [`docs/rbac.md`](docs/rbac.md).

### Delivery State Machine
Delivery status follows a strict graph of allowed transitions enforced by `assertValidTransition()` in `src/lib/delivery-state-machine.ts`. Invalid transitions return HTTP 422 — the UI filters available actions to only show valid next states.

```
DRAFT → PENDING_DISPATCH → ASSIGNED → IN_TRANSIT → DELIVERED
                                                  → FAILED → PENDING_DISPATCH (retry)
        PENDING_DISPATCH, ASSIGNED → CANCELLED
```

### Concurrency-Safe Dispatch
Two dispatchers cannot double-book the same driver or vehicle. The assign endpoint uses `SELECT ... FOR UPDATE` inside a Prisma `$transaction` with consistent lock ordering (Delivery → Driver → Vehicle) to prevent deadlocks. The losing dispatcher receives a `409 CONFLICT` immediately. See [`docs/dispatch-concurrency.md`](docs/dispatch-concurrency.md).

### Real-Time Dispatch Board
A 4-column Kanban board shows `PENDING_DISPATCH`, `ASSIGNED`, `IN_TRANSIT`, and `FAILED` deliveries. Dispatchers can open an inline assign modal to pick a driver and vehicle — available resources are pre-filtered to exclude those already booked on the same date. Status updates use `useTransition` + `router.refresh()` for optimistic UI without a separate state management layer.

### Driver Mobile Interface
A dedicated mobile-first interface at `/driver/[orgSlug]` shows each driver their deliveries for the current day. From this view, drivers can:
- Start a route (transitions to `IN_TRANSIT`)
- Submit proof of delivery (recipient name + optional notes)
- Report a failure with a categorised failure reason

### Proof of Delivery
Proof of delivery is captured as a separate `ProofOfDelivery` record linked 1:1 to the delivery. It stores recipient name, actual delivery timestamp, driver notes, and object storage keys for signature and photo uploads. The proof is submitted atomically with the `DELIVERED` status transition.

### Immutable Audit Logging
Every significant write operation generates an `AuditLog` entry written in the **same database transaction** as the mutation. There is no window where a change exists without an audit entry. Logs are append-only — no `UPDATE` or `DELETE` operations are performed on the `AuditLog` table. Accessible to `OWNER` and `ADMIN` users with pagination and resource-type filtering. See [`docs/audit-logging.md`](docs/audit-logging.md).

### Address Snapshots
Pickup and delivery addresses are snapshotted as JSON at delivery creation time, not stored as foreign keys to live customer address records. If a customer's address changes after a delivery is created, the delivery retains the address the driver was actually given — essential for dispute resolution and accurate proof-of-delivery records.

### Fleet & Maintenance Management
Full CRUD for vehicles with status tracking (`AVAILABLE`, `ASSIGNED`, `IN_MAINTENANCE`, `OUT_OF_SERVICE`). Append-only maintenance records track service history per vehicle with `nextDueAt` timestamps for service reminders. Vehicles in `IN_MAINTENANCE` or `OUT_OF_SERVICE` are automatically excluded from the dispatch assign flow.

### Route Management
Dispatchers can group deliveries into ordered routes and assign a route to a driver and vehicle. Stop order is adjustable — submitting a new `stops` array replaces existing stops atomically. Each route stop holds an address snapshot independent of the delivery.

### Customer Management
Customer profiles with multiple delivery addresses. Address data is managed separately from delivery snapshots — updating a customer's address affects future deliveries only.

### Asynchronous Notifications
Notifications are queued via `setImmediate()` after the transaction commits — they never block business logic or cause a rollback. The abstraction is swappable: changing `queueNotification()` to push to a real queue (BullMQ, SQS) requires touching one file. See [`docs/notifications.md`](docs/notifications.md).

### Live Dashboard Metrics
The dashboard shows 8 real-time metrics derived from live queries — no synthetic or cached data:
- Today's deliveries, active, completed, and failed counts
- Pending dispatch queue depth
- Available drivers and vehicles
- Vehicles currently in maintenance

### Unit-Tested Core Logic
33 unit tests covering the delivery state machine (all valid transitions, all invalid transitions, available-transitions filtering) and the RBAC permission map (role boundaries, minimum and maximum permission sets). Run with `npm test`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Database | PostgreSQL 16 |
| ORM | Prisma 7 + `@prisma/adapter-pg` |
| Auth | NextAuth.js v5 (beta) — JWT sessions, Credentials provider |
| UI | shadcn/ui + Tailwind CSS |
| Validation | Zod v4 |
| Testing | Jest + ts-jest |

---

## Getting Started

### 1. Start the database

```bash
docker compose up -d
```

This starts PostgreSQL 16 on port 5432.

### 2. Configure environment

Copy `.env` and verify the values (defaults work with the Docker Compose setup):

```env
DATABASE_URL="postgresql://fleetflow:fleetflow@localhost:5432/fleetflow"
NEXTAUTH_SECRET="your-super-secret-key-change-in-production-minimum-32-chars"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Apply the schema

```bash
npx prisma migrate dev
```

### 4. Install dependencies and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and create your first organisation via the onboarding form.

### 5. Run tests

```bash
npm test
```

---

## Application Routes

| Path | Description |
|---|---|
| `/` | Landing page / redirect to login |
| `/login` | Sign in with email and password |
| `/register` | Create a new organisation |
| `/[orgSlug]` | Dashboard — live metrics |
| `/[orgSlug]/deliveries` | Delivery list with filtering |
| `/[orgSlug]/deliveries/[id]` | Delivery detail — status transitions, POD, audit timeline |
| `/[orgSlug]/dispatch` | Kanban dispatch board |
| `/[orgSlug]/drivers` | Driver roster |
| `/[orgSlug]/vehicles` | Vehicle fleet |
| `/[orgSlug]/customers` | Customer management |
| `/[orgSlug]/routes` | Route management |
| `/[orgSlug]/maintenance` | Maintenance records |
| `/[orgSlug]/audit-logs` | Immutable audit log (OWNER/ADMIN only) |
| `/[orgSlug]/settings` | Organisation settings and team members |
| `/driver/[orgSlug]` | Mobile driver interface |

---

## Documentation

| Document | Contents |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Request pipeline, module structure, stack rationale |
| [`docs/multi-tenancy.md`](docs/multi-tenancy.md) | Data model, tenant context, RLS design |
| [`docs/delivery-state-machine.md`](docs/delivery-state-machine.md) | Status definitions, transition graph, failure reasons |
| [`docs/dispatch-concurrency.md`](docs/dispatch-concurrency.md) | SELECT FOR UPDATE, lock ordering, deadlock prevention |
| [`docs/rbac.md`](docs/rbac.md) | Role definitions, full permission matrix, enforcement pattern |
| [`docs/audit-logging.md`](docs/audit-logging.md) | Transactional guarantee, schema, immutability |
| [`docs/notifications.md`](docs/notifications.md) | Fire-and-forget pattern, trigger points, production path |
| [`docs/data-model.md`](docs/data-model.md) | Entity relationships, key schema decisions, indexes |
| [`docs/api-reference.md`](docs/api-reference.md) | All REST endpoints, request bodies, error codes |
