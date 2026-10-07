import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getTenantContext, requirePermission, getOrganizationBySlug } from '@/lib/tenant'
import { errorResponse } from '@/lib/errors'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

const createVehicleSchema = z.object({
  registrationNumber: z.string().min(1),
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  type: z.enum(['VAN', 'TRUCK', 'MOTORCYCLE', 'CAR', 'OTHER']),
  mileage: z.number().int().min(0).default(0),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  try {
    const { orgSlug } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'vehicles.read')

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const vehicles = await db.vehicle.findMany({
      where: { organizationId: org.id, ...(status ? { status: status as any } : {}) },
      include: {
        _count: { select: { maintenanceRecords: true, deliveries: true } },
      },
      orderBy: { registrationNumber: 'asc' },
    })
    return Response.json(vehicles)
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  try {
    const { orgSlug } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'vehicles.manage')

    const body = await req.json()
    const data = createVehicleSchema.parse(body)

    const vehicle = await db.$transaction(async (tx) => {
      const v = await tx.vehicle.create({ data: { ...data, organizationId: org.id } })
      await createAuditLog({ ctx, action: 'vehicle.created', resourceType: 'Vehicle', resourceId: v.id, metadata: { reg: v.registrationNumber } }, tx as any)
      return v
    })
    return Response.json(vehicle, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
