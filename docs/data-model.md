# Data Model

## Entity Relationship Overview

```
Organization (tenant root)
│
├── Membership ──► User (global; one user can belong to many orgs)
│     └── role: OWNER | ADMIN | DISPATCHER | FLEET_MANAGER | DRIVER
│
├── Customer
│     └── CustomerAddress[] (multiple delivery addresses per customer)
│
├── Driver (optionally linked to a User for mobile app login)
│
├── Vehicle
│
├── Delivery
│     ├── → Customer (FK)
│     ├── → Driver (FK, nullable — assigned later)
│     ├── → Vehicle (FK, nullable — assigned later)
│     ├── → Route (FK, nullable)
│     ├── pickupAddress: Json    (snapshot at creation time)
│     ├── deliveryAddress: Json  (snapshot at creation time)
│     └── ProofOfDelivery (1:1, created on completion)
│
├── Route
│     ├── → Driver (FK, nullable)
│     ├── → Vehicle (FK, nullable)
│     └── RouteStop[] (ordered by stopOrder)
│
├── MaintenanceRecord → Vehicle
│
├── AuditLog (append-only, never updated or deleted)
│
└── Notification → User
```

## Key Design Decisions

### Address Snapshots on Delivery

Pickup and delivery addresses are stored as `Json` columns on the `Delivery` table rather than foreign keys to `CustomerAddress`:

```typescript
pickupAddress   Json  // { street, city, state, postalCode, country }
deliveryAddress Json  // snapshot — immutable after creation
```

If a customer updates their address after a delivery is created, the delivery retains the address that was current at dispatch time. This is essential for:

- Accurate proof-of-delivery records
- Dispute resolution ("the driver went to the right address")
- Historical reporting that reflects what the driver was actually told

### Delivery-Driver Relationship

`Delivery.driverId` is nullable and optional at creation time. A delivery starts without a driver assignment (`DRAFT` or `PENDING_DISPATCH`) and acquires one during the dispatch flow. The assignment is done through the dedicated `/assign` endpoint (not a generic PATCH) to enforce the concurrency-safe locking protocol.

### User vs Driver

`User` is the authentication identity (email + password). `Driver` is the domain entity that carries logistics-specific data (license number, expiry, operational status). They are linked via `Driver.userId` which is nullable — a driver profile can exist without a login account (for drivers not using the mobile app).

```
User ─────────────── Driver (optional link)
(email, password)    (licenseNumber, licenseExpiry, status)
```

### Route Stops

`RouteStop` is an ordered list of stops within a route. The `stopOrder` integer determines sequence. Dispatchers can reorder stops by submitting a new `stops` array to `PATCH /api/[orgSlug]/routes/[id]`, which deletes all existing stops and creates new ones in a single transaction.

```typescript
model RouteStop {
  routeId    String
  stopOrder  Int      // determines display and navigation order
  deliveryId String?  // links to a Delivery, or null for non-delivery stops (e.g. depot)
  address    Json     // snapshot
  notes      String?
}
```

### Proof of Delivery

`ProofOfDelivery` is a 1:1 extension of `Delivery`, created only when a delivery transitions to `DELIVERED`. It captures:

- `recipientName` — who signed for the package
- `deliveredAt` — timestamp of actual delivery (set by the driver)
- `signatureKey` / `photoKey` — object storage keys for signature and photo files (signed URLs for access)
- `driverNotes` — free text notes from the driver

Separating proof into its own table keeps the `Delivery` table narrow and makes it easy to add fields (e.g. GPS coordinates) without migrating the main table.

### MaintenanceRecord

Maintenance records are append-only — new records are added but existing ones are not updated. The `nextDueAt` field on each record drives maintenance reminders. To determine when a vehicle's next service is due, query for the most recent `MaintenanceRecord` for that vehicle and read `nextDueAt`.

## Indexes

```
Delivery: [organizationId]                    tenant-scoped full table scans
Delivery: [organizationId, status]            dispatch board queries (by status column)
Delivery: [driverId]                          driver's delivery history
AuditLog: [organizationId, createdAt DESC]    paginated audit log (newest first)
AuditLog: [resourceType, resourceId]          per-resource event history
MaintenanceRecord: [organizationId]           org-scoped listing
MaintenanceRecord: [vehicleId]                per-vehicle maintenance history
```

## IDs

All primary keys use `cuid()` (collision-resistant unique IDs). Compared to sequential integers:

- Safe to expose in URLs without leaking record counts
- No coordination required for distributed inserts
- Globally unique across tables (useful for audit log `resourceId`)

## Core Models

Organization, Driver, Vehicle, Delivery, Route, MaintenanceRecord.

## Database

PostgreSQL 15+. Run `npx prisma migrate dev` to initialize.

## Local Stack

`docker-compose up -d` starts PostgreSQL and Redis.

## Code Quality

Strict TS with no-unsafe-any. Zero tolerance for implicit any.

## UI Layer

Tailwind + shadcn/ui for all dispatcher and driver dashboards.

## Vehicle Profiles

Vehicles: make, model, plate, capacity, compliance status.

## Driver Profiles

License class, expiry date, and certification status per driver.

## Inspections

Pre/post-trip inspections with photo evidence and sign-off.

## Maintenance

Scheduled maintenance tracks due date, odometer, and cost.

## Compliance

Registration, insurance, permits — 30-day expiry alerts.

## Driver Schedules

Drivers set availability windows. System prevents over-scheduling.

## Fuel Tracking

Fuel logs per vehicle with cost-per-km calculation.
