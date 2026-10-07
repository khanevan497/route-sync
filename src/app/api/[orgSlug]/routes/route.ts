import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getTenantContext, requirePermission, getOrganizationBySlug } from '@/lib/tenant'
import { errorResponse } from '@/lib/errors'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

const createRouteSchema = z.object({
  name: z.string().min(1),
  date: z.string().datetime(),
  driverId: z.string().optional(),
  vehicleId: z.string().optional(),
  stops: z.array(z.object({
    deliveryId: z.string().optional(),
    stopOrder: z.number().int().min(0),
    address: z.object({ street: z.string(), city: z.string() }),
    notes: z.string().optional(),
  })).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  try {
    const { orgSlug } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'routes.read')

    const routes = await db.route.findMany({
      where: { organizationId: org.id },
      include: {
        driver: { select: { id: true, name: true } },
        vehicle: { select: { id: true, registrationNumber: true, make: true, model: true } },
        stops: { orderBy: { stopOrder: 'asc' } },
        _count: { select: { deliveries: true } },
      },
      orderBy: { date: 'desc' },
    })
    return Response.json(routes)
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  try {
    const { orgSlug } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'routes.manage')

    const body = await req.json()
    const data = createRouteSchema.parse(body)

    const route = await db.$transaction(async (tx) => {
      const r = await tx.route.create({
        data: {
          organizationId: org.id,
          name: data.name,
          date: new Date(data.date),
          driverId: data.driverId,
          vehicleId: data.vehicleId,
          stops: data.stops ? { create: data.stops } : undefined,
        },
        include: { stops: true, driver: true, vehicle: true },
      })
      await createAuditLog({ ctx, action: 'route.created', resourceType: 'Route', resourceId: r.id, metadata: { name: r.name } }, tx as any)
      return r
    })
    return Response.json(route, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
