# Architecture Overview

RouteSync is structured as a **modular monolith** — the entire application runs within a single Next.js deployment, but is divided into clearly separated modules with defined boundaries. Those boundaries make it straightforward to break out individual services should traffic or team size demand it later.

## Why a Modular Monolith

Distributing across microservices too early introduces overhead — service discovery, distributed tracing, inter-service authentication, and network latency on every internal call — that an early-stage product cannot justify. A modular monolith lets us:

- Share one Prisma client and connection pool across all modules
- Keep mutations atomic across multiple domain concerns without distributed transactions
- Ship and scale as a single deployable unit (one Docker image, one health-check endpoint)
- Carve out independent services later without rewriting business logic — the module seams are already in place

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js (App Router) | Server Components for server-side data fetching, API Routes for the REST surface, single deploy target |
| ORM | Prisma 7 + `@prisma/adapter-pg` | Type-safe query builder, migration tooling, raw SQL escape hatch for pessimistic locking |
| Database | PostgreSQL | ACID transactions, row-level locking (`SELECT FOR UPDATE`), RLS support for defence-in-depth |
| Auth | NextAuth.js v5 (beta) | JWT sessions, Credentials provider, PrismaAdapter for session storage |
| UI | shadcn/ui + Tailwind CSS | Accessible Radix primitives, utility-first styling, no runtime CSS-in-JS overhead |
| Validation | Zod | Schema-first validation reused across API handlers and form resolvers |
| Forms | React Hook Form + `@hookform/resolvers/zod` | Uncontrolled inputs, minimal re-renders, Zod schema reuse |
| Notifications | `setImmediate` fire-and-forget | Keeps Redis out of the MVP dependency list; the abstraction is swappable for BullMQ without touching callers |

## Request Flow

Every API route follows the same layered pipeline. Nothing skips a layer.

```
HTTP Request
    │
    ▼
Next.js Middleware (src/middleware.ts)
    │  JWT verification via NextAuth
    │  Redirect unauthenticated requests to /login
    │  Allow /api/auth/* and /api/onboarding unconditionally
    │
    ▼
Route Handler (src/app/api/[orgSlug]/...)
    │
    ▼
getOrganizationBySlug(slug)
    │  Resolves the URL slug to an org ID
    │  Throws NotFoundError (404) if slug is unknown
    │
    ▼
getTenantContext(org.id)          ← src/lib/tenant.ts
    │  Reads JWT session → user ID
    │  Queries Membership table for (userId, organizationId)
    │  Throws ForbiddenError (403) if not a member
    │  Returns { userId, organizationId, role }
    │
    ▼
requirePermission(ctx, 'resource.action')
    │  Central permission check — no inline role comparisons elsewhere
    │  Throws ForbiddenError (403) on failure
    │
    ▼
Zod input validation
    │  schema.parse(body)
    │  Throws ZodError → serialised as 400 Bad Request
    │
    ▼
Application / Domain Logic
    │  Business rules, state machine checks, availability checks
    │
    ▼
db.$transaction(async (tx) => { ... })
    │  All mutations run inside a transaction
    │  Audit log written atomically in the same transaction
    │
    ▼
queueNotification(...)            ← post-commit, fire-and-forget
    │  setImmediate ensures the HTTP response is sent before notification work begins
    │
    ▼
Response.json(result, { status: 2xx })
```

If anything throws an `AppError` subclass, `errorResponse()` maps it to the correct HTTP status code. Unhandled exceptions produce a generic 500.

## Module Structure

```
src/
├── app/
│   ├── (dashboard)/[orgSlug]/     # Admin/dispatcher UI pages (RSC)
│   │   ├── page.tsx               # Dashboard metrics
│   │   ├── deliveries/            # List + detail pages
│   │   ├── dispatch/              # Kanban board
│   │   ├── drivers/               # Driver management
│   │   ├── vehicles/              # Vehicle fleet
│   │   ├── customers/             # Customer management
│   │   ├── routes/                # Route planner
│   │   ├── maintenance/           # Maintenance records
│   │   ├── audit-logs/            # Audit trail (admin only)
│   │   └── settings/              # Org settings + team
│   ├── driver/[orgSlug]/          # Driver mobile interface
│   ├── api/[orgSlug]/             # REST API handlers
│   ├── login/                     # Authentication pages
│   └── register/
├── components/
│   ├── ui/                        # shadcn/ui primitives
│   ├── layout/                    # Sidebar, Header
│   ├── deliveries/                # Delivery-specific components
│   ├── dispatch/                  # Kanban board components
│   ├── driver/                    # Driver mobile components
│   └── shared/                    # Reusable dialogs (create forms)
├── lib/
│   ├── auth.ts                    # NextAuth configuration
│   ├── db.ts                      # Prisma singleton
│   ├── tenant.ts                  # Tenant context + permission guard
│   ├── permissions.ts             # RBAC permission map
│   ├── delivery-state-machine.ts  # Allowed status transitions
│   ├── audit.ts                   # Audit log writer
│   ├── notifications.ts           # Async notification queue
│   ├── errors.ts                  # Typed error hierarchy
│   └── utils.ts                   # Formatting helpers, cn()
├── types/
│   └── index.ts                   # Re-exports Prisma types + composite types
└── __tests__/
    ├── delivery-state-machine.test.ts
    └── permissions.test.ts
```
