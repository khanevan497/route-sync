import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getTenantContext, requirePermission, getOrganizationBySlug } from '@/lib/tenant'
import { errorResponse } from '@/lib/errors'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

const createDeliverySchema = z.object({
  customerId: z.string(),
  pickupAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().default('US'),
  }),
  deliveryAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().default('US'),
  }),
  scheduledDate: z.string().datetime().optional(),
  timeWindowStart: z.string().datetime().optional(),
  timeWindowEnd: z.string().datetime().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  notes: z.string().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'deliveries.read')

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const driverId = searchParams.get('driverId')
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '20')

    const where = {
      organizationId: org.id,
      ...(status ? { status: status as any } : {}),
      ...(driverId ? { driverId } : {}),
    }

    const [deliveries, total] = await Promise.all([
      db.delivery.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, email: true } },
          driver: { select: { id: true, name: true } },
          vehicle: { select: { id: true, registrationNumber: true, make: true, model: true } },
          route: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.delivery.count({ where }),
    ])

    return Response.json({ deliveries, total, page, limit })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'deliveries.create')

    const body = await req.json()
    const data = createDeliverySchema.parse(body)

    // Verify customer belongs to this tenant
    const customer = await db.customer.findFirst({
      where: { id: data.customerId, organizationId: org.id },
    })
    if (!customer) throw new Error('Customer not found')

    const delivery = await db.$transaction(async (tx) => {
      const d = await tx.delivery.create({
        data: {
          organizationId: org.id,
          customerId: data.customerId,
          pickupAddress: data.pickupAddress,
          deliveryAddress: data.deliveryAddress,
          scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
          timeWindowStart: data.timeWindowStart ? new Date(data.timeWindowStart) : undefined,
          timeWindowEnd: data.timeWindowEnd ? new Date(data.timeWindowEnd) : undefined,
          priority: data.priority,
          notes: data.notes,
          status: 'DRAFT',
        },
        include: { customer: true },
      })
      await createAuditLog({
        ctx,
        action: 'delivery.created',
        resourceType: 'Delivery',
        resourceId: d.id,
        metadata: { customerId: d.customerId, priority: d.priority },
      }, tx as any)
      return d
    })

    return Response.json(delivery, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
