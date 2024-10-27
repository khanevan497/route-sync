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
