import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getTenantContext, requirePermission, getOrganizationBySlug } from '@/lib/tenant'
import { errorResponse } from '@/lib/errors'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

const createDriverSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  licenseNumber: z.string().min(1),
  licenseExpiry: z.string().datetime(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  try {
    const { orgSlug } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'drivers.read')

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const drivers = await db.driver.findMany({
      where: {
        organizationId: org.id,
        ...(status ? { status: status as any } : {}),
      },
      include: {
        _count: { select: { deliveries: { where: { status: { in: ['ASSIGNED', 'IN_TRANSIT'] } } } } },
      },
      orderBy: { name: 'asc' },
    })

    return Response.json(drivers)
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  try {
    const { orgSlug } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'drivers.manage')

    const body = await req.json()
    const data = createDriverSchema.parse(body)

    const driver = await db.$transaction(async (tx) => {
      const d = await tx.driver.create({
        data: { ...data, organizationId: org.id, licenseExpiry: new Date(data.licenseExpiry) },
      })
      await createAuditLog({ ctx, action: 'driver.created', resourceType: 'Driver', resourceId: d.id, metadata: { name: d.name } }, tx as any)
      return d
    })

    return Response.json(driver, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
