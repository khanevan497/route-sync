import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getTenantContext, requirePermission, getOrganizationBySlug } from '@/lib/tenant'
import { errorResponse } from '@/lib/errors'
import { createAuditLog } from '@/lib/audit'
import { queueNotification } from '@/lib/notifications'
import { z } from 'zod'

const createMaintenanceSchema = z.object({
  vehicleId: z.string(),
  type: z.enum(['OIL_SERVICE', 'INSPECTION', 'TIRE_REPLACEMENT', 'REPAIR', 'OTHER']),
  description: z.string().min(1),
  mileage: z.number().int().min(0),
  cost: z.number().optional(),
  performedAt: z.string().datetime(),
  nextDueAt: z.string().datetime().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  try {
    const { orgSlug } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'maintenance.read')

    const { searchParams } = new URL(req.url)
    const vehicleId = searchParams.get('vehicleId')

    const records = await db.maintenanceRecord.findMany({
      where: { organizationId: org.id, ...(vehicleId ? { vehicleId } : {}) },
      include: { vehicle: { select: { id: true, registrationNumber: true, make: true, model: true } } },
      orderBy: { performedAt: 'desc' },
    })
    return Response.json(records)
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  try {
    const { orgSlug } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'maintenance.manage')

    const body = await req.json()
    const data = createMaintenanceSchema.parse(body)

    // Verify vehicle belongs to tenant
    const vehicle = await db.vehicle.findFirst({ where: { id: data.vehicleId, organizationId: org.id } })
    if (!vehicle) throw new Error('Vehicle not found')

    const record = await db.$transaction(async (tx) => {
      const r = await tx.maintenanceRecord.create({
        data: {
          organizationId: org.id,
          vehicleId: data.vehicleId,
          type: data.type,
          description: data.description,
          mileage: data.mileage,
          cost: data.cost,
          performedAt: new Date(data.performedAt),
          nextDueAt: data.nextDueAt ? new Date(data.nextDueAt) : undefined,
        },
        include: { vehicle: true },
      })
      await createAuditLog({ ctx, action: 'maintenance.created', resourceType: 'MaintenanceRecord', resourceId: r.id, metadata: { vehicleId: r.vehicleId, type: r.type } }, tx as any)
      return r
    })

    // Notify fleet managers if nextDueAt is set
    if (record.nextDueAt) {
      const fleetManagers = await db.membership.findMany({
        where: { organizationId: org.id, role: { in: ['FLEET_MANAGER', 'ADMIN', 'OWNER'] } },
      })
      for (const m of fleetManagers) {
        queueNotification({
          organizationId: org.id,
          userId: m.userId,
          type: 'MAINTENANCE_DUE',
          title: 'Maintenance Scheduled',
          body: `Next maintenance for ${vehicle.registrationNumber} due ${record.nextDueAt.toLocaleDateString()}`,
          resourceType: 'Vehicle',
          resourceId: data.vehicleId,
        })
      }
    }

    return Response.json(record, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
