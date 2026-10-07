import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getTenantContext, requirePermission, getOrganizationBySlug } from '@/lib/tenant'
import { errorResponse, NotFoundError } from '@/lib/errors'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

const updateVehicleSchema = z.object({
  status: z.enum(['AVAILABLE', 'ASSIGNED', 'IN_MAINTENANCE', 'OUT_OF_SERVICE']).optional(),
  mileage: z.number().int().min(0).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgSlug: string; id: string }> }) {
  try {
    const { orgSlug, id } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'vehicles.read')

    const vehicle = await db.vehicle.findFirst({
      where: { id, organizationId: org.id },
      include: {
        maintenanceRecords: { orderBy: { performedAt: 'desc' }, take: 5 },
        deliveries: { where: { status: { in: ['ASSIGNED', 'IN_TRANSIT'] } }, include: { customer: { select: { name: true } } }, take: 5 },
      },
    })
    if (!vehicle) throw new NotFoundError('Vehicle')
    return Response.json(vehicle)
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgSlug: string; id: string }> }) {
  try {
    const { orgSlug, id } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'vehicles.manage')

    const body = await req.json()
    const data = updateVehicleSchema.parse(body)

    const existing = await db.vehicle.findFirst({ where: { id, organizationId: org.id } })
    if (!existing) throw new NotFoundError('Vehicle')

    const vehicle = await db.$transaction(async (tx) => {
      const v = await tx.vehicle.update({ where: { id }, data })
      await createAuditLog({ ctx, action: 'vehicle.status_changed', resourceType: 'Vehicle', resourceId: id, metadata: { from: existing.status, to: data.status } }, tx as any)
      return v
    })
    return Response.json(vehicle)
  } catch (err) {
    return errorResponse(err)
  }
}
