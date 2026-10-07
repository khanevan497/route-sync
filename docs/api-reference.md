# API Reference

All routes are prefixed with `/api/[orgSlug]`. Every request must be authenticated (JWT session cookie). Every route validates tenant membership before executing.

## Authentication

```
POST /api/auth/signin
POST /api/auth/signout
GET  /api/auth/session
```

Handled by NextAuth.js. Uses the Credentials provider (email + password). Returns a JWT session stored as an HTTP-only cookie.

## Onboarding

```
POST /api/onboarding
```

Creates a new User, Organization, and Membership (OWNER role) in a single transaction. The only public endpoint — no authentication required.

**Body:**
```json
{
  "orgName": "Acme Logistics",
  "slug": "acme-logistics",
  "userName": "Jane Smith",
  "email": "jane@acme.com",
  "password": "minimum8chars"
}
```

---

## Deliveries

```
GET    /api/[orgSlug]/deliveries
POST   /api/[orgSlug]/deliveries
GET    /api/[orgSlug]/deliveries/[id]
PATCH  /api/[orgSlug]/deliveries/[id]
POST   /api/[orgSlug]/deliveries/[id]/assign
POST   /api/[orgSlug]/deliveries/[id]/status
POST   /api/[orgSlug]/deliveries/[id]/proof
```

### GET /deliveries

Query params: `status`, `driverId`, `page` (default 1), `limit` (default 20)

Returns paginated delivery list with customer, driver, vehicle, and route summaries.

Required permission: `deliveries.read`

### POST /deliveries

Creates a delivery in `DRAFT` status. Pickup and delivery addresses are snapshotted immediately.

Required permission: `deliveries.create`

**Body:**
```json
{
  "customerId": "...",
  "pickupAddress": { "street": "...", "city": "...", "state": "...", "postalCode": "...", "country": "US" },
  "deliveryAddress": { "street": "...", "city": "...", "state": "..." },
  "scheduledDate": "2024-03-15T00:00:00.000Z",
  "timeWindowStart": "2024-03-15T09:00:00.000Z",
  "timeWindowEnd": "2024-03-15T12:00:00.000Z",
  "priority": "HIGH",
  "notes": "Leave at the back door"
}
```

### POST /deliveries/[id]/assign

Assigns a driver and vehicle using a concurrency-safe `SELECT FOR UPDATE` transaction. Returns `409 CONFLICT` if the resources are unavailable or already booked.

Required permission: `deliveries.dispatch`

**Body:**
```json
{ "driverId": "...", "vehicleId": "..." }
```

**Error codes:**
- `409` — Driver or vehicle already assigned to a conflicting delivery on this date
- `409` — Driver is not `ACTIVE`
- `409` — Vehicle is `IN_MAINTENANCE` or `OUT_OF_SERVICE`
- `422` — Delivery is not in a dispatchable status

### POST /deliveries/[id]/status

Transitions the delivery to a new status. Enforces the state machine — invalid transitions return `422`.

Required permission: `deliveries.update`

**Body:**
```json
{
  "status": "FAILED",
  "failureReason": "CUSTOMER_UNAVAILABLE",
  "failureNote": "Called twice, no answer"
}
```

`failureReason` is required when transitioning to `FAILED`. One of: `CUSTOMER_UNAVAILABLE`, `WRONG_ADDRESS`, `DAMAGED_PACKAGE`, `REFUSED_DELIVERY`, `VEHICLE_ISSUE`, `OTHER`.

### POST /deliveries/[id]/proof

Submits proof of delivery and atomically transitions the delivery to `DELIVERED`. Only valid when status is `IN_TRANSIT`.

Required permission: `deliveries.update`

**Body:**
```json
{
  "recipientName": "Bob Jones",
  "deliveredAt": "2024-03-15T11:32:00.000Z",
  "driverNotes": "Left with reception",
  "signatureKey": "uploads/sig-abc123.png",
  "photoKey": "uploads/photo-abc123.jpg"
}
```

---

## Drivers

```
GET    /api/[orgSlug]/drivers          ?status=ACTIVE
POST   /api/[orgSlug]/drivers
GET    /api/[orgSlug]/drivers/[id]
PATCH  /api/[orgSlug]/drivers/[id]
```

Required permissions: `drivers.read` (GET), `drivers.manage` (POST/PATCH)

**Create body:**
```json
{
  "name": "John Smith",
  "email": "john@example.com",
  "phone": "+1 555 0100",
  "licenseNumber": "DL123456",
  "licenseExpiry": "2026-12-31T00:00:00.000Z"
}
```

**Update body:** Any subset of `{ name, phone, licenseNumber, licenseExpiry, status }`

Driver `status` values: `ACTIVE`, `INACTIVE`, `SUSPENDED`

---

## Vehicles

```
GET    /api/[orgSlug]/vehicles         ?status=AVAILABLE
POST   /api/[orgSlug]/vehicles
GET    /api/[orgSlug]/vehicles/[id]
PATCH  /api/[orgSlug]/vehicles/[id]
```

Required permissions: `vehicles.read` (GET), `vehicles.manage` (POST/PATCH)

**Create body:**
```json
{
  "registrationNumber": "ABC-1234",
  "make": "Ford",
  "model": "Transit",
  "year": 2023,
  "type": "VAN",
  "mileage": 15000
}
```

Vehicle `type` values: `VAN`, `TRUCK`, `MOTORCYCLE`, `CAR`, `OTHER`

Vehicle `status` values: `AVAILABLE`, `ASSIGNED`, `IN_MAINTENANCE`, `OUT_OF_SERVICE`

Vehicles with status `IN_MAINTENANCE` or `OUT_OF_SERVICE` cannot be assigned to deliveries.

---

## Customers

```
GET    /api/[orgSlug]/customers        ?search=partial+name
POST   /api/[orgSlug]/customers
PATCH  /api/[orgSlug]/customers/[id]
```

Required permissions: `customers.read` (GET), `customers.manage` (POST/PATCH)

Customers can have multiple addresses. Addresses are attached at creation time or updated separately.

---

## Routes

```
GET    /api/[orgSlug]/routes
POST   /api/[orgSlug]/routes
GET    /api/[orgSlug]/routes/[id]
PATCH  /api/[orgSlug]/routes/[id]
```

Required permissions: `routes.read` (GET), `routes.manage` (POST/PATCH)

A route groups ordered delivery stops. When `stops` is provided in a PATCH body, all existing stops are deleted and replaced (reorder semantics).

---

## Maintenance

```
GET    /api/[orgSlug]/maintenance      ?vehicleId=...
POST   /api/[orgSlug]/maintenance
```

Required permissions: `maintenance.read` (GET), `maintenance.manage` (POST)

**Create body:**
```json
{
  "vehicleId": "...",
  "type": "OIL_SERVICE",
  "description": "Full service at 50,000km",
  "mileage": 50000,
  "cost": 249.99,
  "performedAt": "2024-03-10T09:00:00.000Z",
  "nextDueAt": "2024-09-10T09:00:00.000Z"
}
```

`type` values: `OIL_SERVICE`, `INSPECTION`, `TIRE_REPLACEMENT`, `REPAIR`, `OTHER`

---

## Dashboard

```
GET /api/[orgSlug]/dashboard
```

Returns 8 real-time metrics derived from live data. No fake or cached analytics.

```json
{
  "todayDeliveries": 12,
  "activeDeliveries": 7,
  "completedDeliveries": 3,
  "failedDeliveries": 1,
  "pendingDispatch": 4,
  "availableDrivers": 5,
  "availableVehicles": 8,
  "vehiclesInMaintenance": 1
}
```

---

## Audit Logs

```
GET /api/[orgSlug]/audit-logs    ?page=1&limit=50&resourceType=Delivery
```

Required permission: `audit.read` (OWNER and ADMIN only)

Returns paginated audit events in reverse chronological order.

---

## Notifications

```
GET   /api/[orgSlug]/notifications    → last 20 for current user
PATCH /api/[orgSlug]/notifications    → mark all as read
```

---

## Error Format

All errors use a consistent shape:

```json
{
  "error": "Driver is not active",
  "code": "CONFLICT"
}
```

| HTTP Status | Code | Meaning |
|---|---|---|
| 400 | — | Validation failure (Zod parse error) |
| 401 | `UNAUTHORIZED` | No valid session |
| 403 | `FORBIDDEN` | Valid session but insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found (or belongs to another tenant) |
| 409 | `CONFLICT` | Concurrency conflict — resource already claimed |
| 422 | `INVALID_TRANSITION` | State machine violation |
| 500 | — | Unhandled server error |

## Error Structure

All errors return `{ code, message, details }` with HTTP status.

## Validation

Zod schemas validate all incoming delivery and driver data.

## Status Updates

`PATCH /api/deliveries/:id/status` validates transition first.

## List API

`GET /api/deliveries?status=&from=&to=&driver=` paginated.

## Performance Reports

On-time rate, avg delivery time, and exception counts.

## Cost Analytics

Breakdown: fuel, labor, and maintenance per delivery unit.

## 422 Responses

Invalid transitions return 422 with from-state and attempted state.
