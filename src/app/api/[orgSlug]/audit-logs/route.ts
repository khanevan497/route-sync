import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getTenantContext, requirePermission, getOrganizationBySlug } from '@/lib/tenant'
import { errorResponse } from '@/lib/errors'

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  try {
    const { orgSlug } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'audit.read')

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '50')
    const resourceType = searchParams.get('resourceType')

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where: { organizationId: org.id, ...(resourceType ? { resourceType } : {}) },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.auditLog.count({ where: { organizationId: org.id } }),
    ])
    return Response.json({ logs, total, page, limit })
  } catch (err) {
    return errorResponse(err)
  }
}
