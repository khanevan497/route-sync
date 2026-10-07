import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getTenantContext, requirePermission, getOrganizationBySlug } from '@/lib/tenant'
import { errorResponse, NotFoundError, ConflictError } from '@/lib/errors'
import { createAuditLog } from '@/lib/audit'
import { queueNotification } from '@/lib/notifications'
import { z } from 'zod'

const assignSchema = z.object({
  driverId: z.string(),
  vehicleId: z.string(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; id: string }> },
) {
  try {
    const { orgSlug, id } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)
    await requirePermission(ctx, 'deliveries.dispatch')

    const body = await req.json()
    const { driverId, vehicleId } = assignSchema.parse(body)

    // Use raw SQL transaction with SELECT FOR UPDATE for concurrency safety
    const result = await db.$transaction(async (tx) => {
      // Lock the delivery row
      const deliveries = await tx.$queryRaw<Array<{ id: string; status: string; organizationId: string }>>`
        SELECT id, status, "organizationId" FROM "Delivery" WHERE id = ${id} FOR UPDATE
      `
      const delivery = deliveries[0]
      if (!delivery) throw new NotFoundError('Delivery')
      if (delivery.organizationId !== org.id) throw new NotFoundError('Delivery')
      if (!['PENDING_DISPATCH', 'FAILED'].includes(delivery.status)) {
        throw new ConflictError(`Cannot assign delivery in status: ${delivery.status}`)
      }

      // Lock and validate driver
      const drivers = await tx.$queryRaw<Array<{ id: string; status: string; organizationId: string }>>`
        SELECT id, status, "organizationId" FROM "Driver" WHERE id = ${driverId} FOR UPDATE
      `
      const driver = drivers[0]
      if (!driver || driver.organizationId !== org.id) throw new NotFoundError('Driver')
      if (driver.status !== 'ACTIVE') throw new ConflictError('Driver is not active')

      // Lock and validate vehicle
      const vehicles = await tx.$queryRaw<Array<{ id: string; status: string; organizationId: string }>>`
        SELECT id, status, "organizationId" FROM "Vehicle" WHERE id = ${vehicleId} FOR UPDATE
      `
      const vehicle = vehicles[0]
      if (!vehicle || vehicle.organizationId !== org.id) throw new NotFoundError('Vehicle')
      if (['IN_MAINTENANCE', 'OUT_OF_SERVICE'].includes(vehicle.status)) {
        throw new ConflictError(`Vehicle is ${vehicle.status}`)
      }

      // Check conflicting assignments for same scheduled date
      const [deliveryData] = await tx.$queryRaw<Array<{ scheduledDate: Date | null }>>`
        SELECT "scheduledDate" FROM "Delivery" WHERE id = ${id}
      `

      if (deliveryData?.scheduledDate) {
        const date = deliveryData.scheduledDate
        const startOfDay = new Date(date)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(date)
        endOfDay.setHours(23, 59, 59, 999)

        const conflictingDriver = await tx.delivery.findFirst({
          where: {
            id: { not: id },
            driverId,
            organizationId: org.id,
            status: { in: ['ASSIGNED', 'IN_TRANSIT'] },
            scheduledDate: { gte: startOfDay, lte: endOfDay },
          },
        })
        if (conflictingDriver) throw new ConflictError('Driver already assigned to a conflicting delivery on this date')

        const conflictingVehicle = await tx.delivery.findFirst({
          where: {
            id: { not: id },
            vehicleId,
            organizationId: org.id,
            status: { in: ['ASSIGNED', 'IN_TRANSIT'] },
            scheduledDate: { gte: startOfDay, lte: endOfDay },
          },
        })
        if (conflictingVehicle) throw new ConflictError('Vehicle already assigned to a conflicting delivery on this date')
      }

      const previousDriverId = delivery.status === 'ASSIGNED' ? (await tx.delivery.findUnique({ where: { id }, select: { driverId: true } }))?.driverId : undefined
      const isReassignment = !!previousDriverId && previousDriverId !== driverId

      const updated = await tx.delivery.update({
        where: { id },
        data: {
          driverId,
          vehicleId,
          status: 'ASSIGNED',
        },
        include: { driver: true, vehicle: true },
      })

      await createAuditLog({
        ctx,
        action: isReassignment ? 'delivery.reassigned' : 'delivery.assigned',
        resourceType: 'Delivery',
        resourceId: id,
        metadata: { driverId, vehicleId, previousDriverId },
      }, tx as any)

      const driverRecord = await tx.driver.findUnique({ where: { id: driverId }, select: { userId: true } })

      return { updated, driverUserId: driverRecord?.userId ?? null, isReassignment }
    })

    // Notify driver after successful commit
    if (result.driverUserId) {
      queueNotification({
        organizationId: org.id,
        userId: result.driverUserId,
        type: result.isReassignment ? 'DELIVERY_REASSIGNED' : 'DELIVERY_ASSIGNED',
        title: result.isReassignment ? 'Delivery Reassigned' : 'New Delivery Assigned',
        body: `You have been assigned delivery ${id.slice(-8)}`,
        resourceType: 'Delivery',
        resourceId: id,
      })
    }

    return Response.json(result.updated)
  } catch (err) {
    return errorResponse(err)
  }
}
