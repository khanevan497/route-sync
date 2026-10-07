import { DeliveryStatus } from '@prisma/client'
import { AppError } from '@/lib/errors'

type Transition = [DeliveryStatus, DeliveryStatus]

const ALLOWED_TRANSITIONS: Transition[] = [
  ['DRAFT', 'PENDING_DISPATCH'],
  ['PENDING_DISPATCH', 'ASSIGNED'],
  ['ASSIGNED', 'IN_TRANSIT'],
  ['IN_TRANSIT', 'DELIVERED'],
  ['IN_TRANSIT', 'FAILED'],
  ['PENDING_DISPATCH', 'CANCELLED'],
  ['ASSIGNED', 'CANCELLED'],
  ['FAILED', 'PENDING_DISPATCH'], // allow re-dispatch after failure
]

export function assertValidTransition(from: DeliveryStatus, to: DeliveryStatus): void {
  const allowed = ALLOWED_TRANSITIONS.some(([f, t]) => f === from && t === to)
  if (!allowed) {
    throw new AppError(
      `Invalid status transition: ${from} → ${to}`,
      422,
      'INVALID_TRANSITION',
    )
  }
}

export function getAvailableTransitions(from: DeliveryStatus): DeliveryStatus[] {
  return ALLOWED_TRANSITIONS.filter(([f]) => f === from).map(([, t]) => t)
}
