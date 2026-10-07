# Multi-Tenancy

RouteSync uses a **shared-database, shared-schema** tenancy model. All tenant data lives in the same tables, separated by an `organizationId` column that appears on every tenant-owned table.

## Data Model

```
User ─────────────── Membership ─────────────── Organization
(global identity)    (role per org)              (tenant root)
                          │
                          └── role: OWNER | ADMIN | DISPATCHER
                                    FLEET_MANAGER | DRIVER

Organization
  ├── Driver[]
  ├── Vehicle[]
  ├── Customer[]
  ├── Delivery[]
  ├── Route[]
  ├── MaintenanceRecord[]
  ├── AuditLog[]
  └── Notification[]
```

A `User` is a global identity — the same account can belong to multiple organizations, holding a different role in each. The `Membership` join table records the role for each (user, org) pair.

## Tenant Context Enforcement

Tenant isolation is enforced through `getTenantContext()` in `src/lib/tenant.ts`, called at the start of every API route handler:

```typescript
// 1. Resolve slug → org ID (the client is never trusted to supply an org ID directly)
const org = await getOrganizationBySlug(orgSlug)

// 2. Verify the authenticated user holds a membership in this org
const ctx = await getTenantContext(org.id)
// → throws ForbiddenError (403) if no Membership record exists

// 3. Confirm the user's role grants the required permission
await requirePermission(ctx, 'deliveries.dispatch')
// → throws ForbiddenError (403) if permission is absent
```

The `organizationId` used in all subsequent queries comes from `ctx.organizationId` — a value validated against the database, never taken from the request body or query parameters. This prevents a client from substituting a foreign tenant's ID to access another tenant's data.

## Prisma Query Pattern

All queries scoping tenant data include `organizationId: ctx.organizationId` in their `where` clause:

```typescript
// Always scoped — never query tenant data without organizationId
const delivery = await db.delivery.findFirst({
  where: { id, organizationId: ctx.organizationId },
})
// A delivery belonging to another tenant returns null
// → surfaced as NotFoundError (404), not 403
// This avoids leaking the existence of resources in other tenants
```

Returning 404 (instead of 403) when a cross-tenant ID is supplied is intentional: it does not reveal whether the resource exists at all.

## PostgreSQL Row-Level Security

The schema is designed for PostgreSQL RLS as a defence-in-depth layer. In production, RLS policies on all tenant tables can verify `current_setting('app.tenant_id') = "organizationId"`. The application sets this session variable before executing queries:

```sql
-- Example RLS policy (production hardening)
ALTER TABLE "Delivery" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Delivery"
  USING ("organizationId" = current_setting('app.tenant_id'));
```

Even if a bug in application code omitted the `organizationId` filter, the database itself would block rows from the wrong tenant. Application-level checks are the primary gate; RLS is the safety net.

## Organization Slug in URLs

Routes are namespaced by organization slug (`/{orgSlug}/...`). The slug is a URL-safe identifier (lowercase alphanumeric + hyphens) chosen at registration. It serves as the tenant's stable URL namespace without embedding internal database IDs in the URL.

Slugs are always resolved to an `organizationId` via a database lookup before tenant context is established. Client-supplied slugs are never trusted directly.

## Cross-Tenant Security Tests

The test suite includes mandatory cross-tenant isolation checks:

- Tenant A cannot read Tenant B's deliveries, drivers, vehicles, customers, or maintenance records
- A valid resource ID belonging to another tenant returns 404, not the resource
- `getTenantContext()` rejects any user without a Membership record in the target org

## Session Scoping

JWT tokens carry `organizationId` and `role` per request.

## Slug Resolution

URL slugs resolve to `organizationId` before any database query runs.
