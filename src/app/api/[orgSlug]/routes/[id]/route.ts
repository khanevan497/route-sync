import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getTenantContext, requirePermission, getOrganizationBySlug } from '@/lib/tenant'
import { errorResponse, NotFoundError } from '@/lib/errors'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

const updateRouteSchema = z.object({
  name: z.string().optional(),
  driverId: z.string().optional().nullable(),
  vehicleId: z.string().optional().nullable(),
  status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  stops: z.array(z.object({
    id: z.string().optional(),
    deliveryId: z.string().optional(),
    stopOrder: z.number().int().min(0),
    address: z.object({ street: z.string(), city: z.string() }),
    notes: z.string().optional(),
  })).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgSlug: string; id: string }> }) {
  try {
    const { orgSlug, id } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'routes.read')

    const route = await db.route.findFirst({
      where: { id, organizationId: org.id },
      include: {
        driver: true,
        vehicle: true,
        stops: { orderBy: { stopOrder: 'asc' } },
        deliveries: { include: { customer: { select: { name: true } } } },
      },
    })
    if (!route) throw new NotFoundError('Route')
    return Response.json(route)
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgSlug: string; id: string }> }) {
  try {
    const { orgSlug, id } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'routes.manage')

    const body = await req.json()
    const data = updateRouteSchema.parse(body)

    const existing = await db.route.findFirst({ where: { id, organizationId: org.id } })
    if (!existing) throw new NotFoundError('Route')

    const route = await db.$transaction(async (tx) => {
      if (data.stops) {
        await tx.routeStop.deleteMany({ where: { routeId: id } })
        await tx.routeStop.createMany({ data: data.stops.map(s => ({ ...s, routeId: id, id: undefined })) })
      }
      const r = await tx.route.update({
        where: { id },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.driverId !== undefined ? { driverId: data.driverId } : {}),
          ...(data.vehicleId !== undefined ? { vehicleId: data.vehicleId } : {}),
          ...(data.status ? { status: data.status } : {}),
        },
        include: { stops: { orderBy: { stopOrder: 'asc' } }, driver: true, vehicle: true },
      })
      await createAuditLog({ ctx, action: 'route.updated', resourceType: 'Route', resourceId: id, metadata: { changes: data } }, tx as any)
      return r
    })
    return Response.json(route)
  } catch (err) {
    return errorResponse(err)
  }
}
