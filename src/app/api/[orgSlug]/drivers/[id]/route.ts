import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getTenantContext, requirePermission, getOrganizationBySlug } from '@/lib/tenant'
import { errorResponse, NotFoundError } from '@/lib/errors'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

const updateDriverSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  licenseNumber: z.string().optional(),
  licenseExpiry: z.string().datetime().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgSlug: string; id: string }> }) {
  try {
    const { orgSlug, id } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'drivers.read')

    const driver = await db.driver.findFirst({
      where: { id, organizationId: org.id },
      include: {
        deliveries: {
          where: { status: { in: ['ASSIGNED', 'IN_TRANSIT'] } },
          include: { customer: { select: { name: true } } },
          take: 10,
        },
      },
    })
    if (!driver) throw new NotFoundError('Driver')
    return Response.json(driver)
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgSlug: string; id: string }> }) {
  try {
    const { orgSlug, id } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'drivers.manage')

    const body = await req.json()
    const data = updateDriverSchema.parse(body)

    const existing = await db.driver.findFirst({ where: { id, organizationId: org.id } })
    if (!existing) throw new NotFoundError('Driver')

    const driver = await db.$transaction(async (tx) => {
      const d = await tx.driver.update({
        where: { id },
        data: { ...data, ...(data.licenseExpiry ? { licenseExpiry: new Date(data.licenseExpiry) } : {}) },
      })
      await createAuditLog({ ctx, action: 'driver.updated', resourceType: 'Driver', resourceId: id, metadata: data }, tx as any)
      return d
    })
    return Response.json(driver)
  } catch (err) {
    return errorResponse(err)
  }
}
