import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getTenantContext, requirePermission, getOrganizationBySlug } from '@/lib/tenant'
import { errorResponse, NotFoundError, AppError } from '@/lib/errors'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

const proofSchema = z.object({
  recipientName: z.string().min(1),
  deliveredAt: z.string().datetime(),
  driverNotes: z.string().optional(),
  signatureKey: z.string().optional(),
  photoKey: z.string().optional(),
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
    const data = proofSchema.parse(body)

    const delivery = await db.delivery.findFirst({
      where: { id, organizationId: org.id },
    })
    if (!delivery) throw new NotFoundError('Delivery')
    if (delivery.status !== 'IN_TRANSIT') {
      throw new AppError('Proof of delivery can only be submitted for IN_TRANSIT deliveries', 422)
    }

    const proof = await db.$transaction(async (tx) => {
      const p = await tx.proofOfDelivery.create({
        data: {
          organizationId: org.id,
          deliveryId: id,
          recipientName: data.recipientName,
          deliveredAt: new Date(data.deliveredAt),
          driverNotes: data.driverNotes,
          signatureKey: data.signatureKey,
          photoKey: data.photoKey,
        },
      })
      await tx.delivery.update({
        where: { id },
        data: { status: 'DELIVERED' },
      })
      await createAuditLog({
        ctx,
        action: 'delivery.proof_submitted',
        resourceType: 'Delivery',
        resourceId: id,
        metadata: { recipientName: data.recipientName, deliveredAt: data.deliveredAt },
      }, tx as any)
      return p
    })

    return Response.json(proof, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
