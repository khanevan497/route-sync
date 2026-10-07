import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getTenantContext, getOrganizationBySlug } from '@/lib/tenant'
import { errorResponse } from '@/lib/errors'

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  try {
    const { orgSlug } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)

    const notifications = await db.notification.findMany({
      where: { organizationId: org.id, userId: ctx.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return Response.json(notifications)
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  try {
    const { orgSlug } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)

    await db.notification.updateMany({
      where: { organizationId: org.id, userId: ctx.userId, read: false },
      data: { read: true },
    })
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
