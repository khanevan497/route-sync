import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getTenantContext, requirePermission, getOrganizationBySlug } from '@/lib/tenant'
import { errorResponse, NotFoundError } from '@/lib/errors'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

const updateDeliverySchema = z.object({
  notes: z.string().optional(),
  scheduledDate: z.string().datetime().optional().nullable(),
  timeWindowStart: z.string().datetime().optional().nullable(),
  timeWindowEnd: z.string().datetime().optional().nullable(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; id: string }> },
) {
  try {
    const { orgSlug, id } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'deliveries.read')

    const delivery = await db.delivery.findFirst({
      where: { id, organizationId: org.id },
      include: {
        customer: true,
        driver: true,
        vehicle: true,
        route: { include: { stops: { orderBy: { stopOrder: 'asc' } } } },
        proofOfDelivery: true,
      },
    })
    if (!delivery) throw new NotFoundError('Delivery')

    return Response.json(delivery)
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; id: string }> },
) {
  try {
    const { orgSlug, id } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'deliveries.update')

    const body = await req.json()
    const data = updateDeliverySchema.parse(body)

    const existing = await db.delivery.findFirst({
      where: { id, organizationId: org.id },
    })
    if (!existing) throw new NotFoundError('Delivery')

    const delivery = await db.$transaction(async (tx) => {
      const d = await tx.delivery.update({
        where: { id },
        data: {
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
          ...(data.priority ? { priority: data.priority } : {}),
          ...(data.scheduledDate !== undefined ? { scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null } : {}),
          ...(data.timeWindowStart !== undefined ? { timeWindowStart: data.timeWindowStart ? new Date(data.timeWindowStart) : null } : {}),
          ...(data.timeWindowEnd !== undefined ? { timeWindowEnd: data.timeWindowEnd ? new Date(data.timeWindowEnd) : null } : {}),
        },
      })
      await createAuditLog({
        ctx, action: 'delivery.updated', resourceType: 'Delivery', resourceId: id,
        metadata: data,
      }, tx as any)
      return d
    })

    return Response.json(delivery)
  } catch (err) {
    return errorResponse(err)
  }
}
