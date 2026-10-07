import { db } from '@/lib/db'
import { TenantContext } from '@/lib/tenant'

interface AuditParams {
  ctx: TenantContext
  action: string
  resourceType: string
  resourceId: string
  metadata?: Record<string, unknown>
  requestId?: string
}

export async function createAuditLog(params: AuditParams, txClient?: typeof db) {
  const client = txClient ?? db
  await (client as typeof db).auditLog.create({
    data: {
      organizationId: params.ctx.organizationId,
      actorUserId: params.ctx.userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      metadata: (params.metadata ?? {}) as object,
      requestId: params.requestId,
    },
  })
}
