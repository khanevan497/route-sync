import { db } from '@/lib/db'
import { NotificationType } from '@prisma/client'

interface NotifyParams {
  organizationId: string
  userId: string
  type: NotificationType
  title: string
  body: string
  resourceType?: string
  resourceId?: string
}

// Fire-and-forget: notification failures never block business logic
export function queueNotification(params: NotifyParams): void {
  setImmediate(async () => {
    try {
      await db.notification.create({ data: params })
    } catch (err) {
      console.error('[notification] Failed to create notification:', err)
    }
  })
}
