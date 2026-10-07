import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getTenantContext, requirePermission, getOrganizationBySlug } from '@/lib/tenant'
import { errorResponse, NotFoundError } from '@/lib/errors'
import { createAuditLog } from '@/lib/audit'
import { assertValidTransition } from '@/lib/delivery-state-machine'
import { queueNotification } from '@/lib/notifications'
import { z } from 'zod'
import { DeliveryStatus } from '@prisma/client'

const statusSchema = z.object({
  status: z.nativeEnum(DeliveryStatus),
  failureReason: z.enum(['CUSTOMER_UNAVAILABLE', 'WRONG_ADDRESS', 'DAMAGED_PACKAGE', 'REFUSED_DELIVERY', 'VEHICLE_ISSUE', 'OTHER']).optional(),
  failureNote: z.string().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; id: string }> },
) {
  try {
    const { orgSlug, id } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'deliveries.update')

    const body = await req.json()
    const data = statusSchema.parse(body)

    const delivery = await db.delivery.findFirst({
      where: { id, organizationId: org.id },
      include: { driver: true },
    })
    if (!delivery) throw new NotFoundError('Delivery')

    assertValidTransition(delivery.status, data.status)

    const updated = await db.$transaction(async (tx) => {
      const d = await tx.delivery.update({
        where: { id },
        data: {
          status: data.status,
          ...(data.failureReason ? { failureReason: data.failureReason } : {}),
          ...(data.failureNote ? { failureNote: data.failureNote } : {}),
        },
      })
      await createAuditLog({
        ctx,
        action: 'delivery.status_changed',
        resourceType: 'Delivery',
        resourceId: id,
        metadata: { from: delivery.status, to: data.status, failureReason: data.failureReason },
      }, tx as any)
      return d
    })

    // Queue notifications post-commit
    if (data.status === 'FAILED' && delivery.driverId) {
      const members = await db.membership.findMany({
        where: { organizationId: org.id, role: { in: ['OWNER', 'ADMIN', 'DISPATCHER'] } },
      })
      for (const m of members) {
        queueNotification({
          organizationId: org.id,
          userId: m.userId,
          type: 'DELIVERY_FAILED',
          title: 'Delivery Failed',
          body: `Delivery ${id.slice(-8)} failed: ${data.failureReason ?? 'Unknown reason'}`,
          resourceType: 'Delivery',
          resourceId: id,
        })
      }
    }

    return Response.json(updated)
  } catch (err) {
    return errorResponse(err)
  }
}
