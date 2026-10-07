import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { UnauthorizedError, ForbiddenError, NotFoundError } from '@/lib/errors'
import { MemberRole } from '@prisma/client'
import { hasPermission, Permission } from '@/lib/permissions'

export interface TenantContext {
  userId: string
  organizationId: string
  role: MemberRole
}

export async function getTenantContext(organizationId: string): Promise<TenantContext> {
  const session = await auth()
  if (!session?.user?.id) throw new UnauthorizedError()

  const membership = await db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId,
      },
    },
  })

  if (!membership) throw new ForbiddenError('Not a member of this organization')

  return {
    userId: session.user.id,
    organizationId,
    role: membership.role,
  }
}

export async function requirePermission(
  ctx: TenantContext,
  permission: Permission,
) {
  if (!hasPermission(ctx.role, permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`)
  }
}

export async function getOrganizationBySlug(slug: string) {
  const org = await db.organization.findUnique({ where: { slug } })
  if (!org) throw new NotFoundError('Organization')
  return org
}
