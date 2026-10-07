import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getTenantContext, requirePermission, getOrganizationBySlug } from '@/lib/tenant'
import { errorResponse } from '@/lib/errors'
import { z } from 'zod'

const addressSchema = z.object({
  label: z.string().optional(),
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default('US'),
  isDefault: z.boolean().default(false),
})

const createCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  addresses: z.array(addressSchema).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  try {
    const { orgSlug } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'customers.read')

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')

    const customers = await db.customer.findMany({
      where: {
        organizationId: org.id,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: { addresses: true, _count: { select: { deliveries: true } } },
      orderBy: { name: 'asc' },
    })
    return Response.json(customers)
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  try {
    const { orgSlug } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'customers.manage')

    const body = await req.json()
    const data = createCustomerSchema.parse(body)

    const customer = await db.customer.create({
      data: {
        organizationId: org.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        addresses: data.addresses ? { create: data.addresses } : undefined,
      },
      include: { addresses: true },
    })
    return Response.json(customer, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
