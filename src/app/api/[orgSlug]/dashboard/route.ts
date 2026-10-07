import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getTenantContext, getOrganizationBySlug } from '@/lib/tenant'
import { errorResponse } from '@/lib/errors'

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  try {
    const { orgSlug } = await params
    const org = await getOrganizationBySlug(orgSlug)
    const ctx = await getTenantContext(org.id)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [
      todayDeliveries,
      activeDeliveries,
      completedDeliveries,
      failedDeliveries,
      pendingDispatch,
      availableDrivers,
      availableVehicles,
      vehiclesInMaintenance,
    ] = await Promise.all([
      db.delivery.count({ where: { organizationId: org.id, scheduledDate: { gte: today, lt: tomorrow } } }),
      db.delivery.count({ where: { organizationId: org.id, status: { in: ['ASSIGNED', 'IN_TRANSIT'] } } }),
      db.delivery.count({ where: { organizationId: org.id, status: 'DELIVERED', updatedAt: { gte: today } } }),
      db.delivery.count({ where: { organizationId: org.id, status: 'FAILED' } }),
      db.delivery.count({ where: { organizationId: org.id, status: 'PENDING_DISPATCH' } }),
      db.driver.count({ where: { organizationId: org.id, status: 'ACTIVE' } }),
      db.vehicle.count({ where: { organizationId: org.id, status: 'AVAILABLE' } }),
      db.vehicle.count({ where: { organizationId: org.id, status: 'IN_MAINTENANCE' } }),
    ])

    return Response.json({
      todayDeliveries,
      activeDeliveries,
      completedDeliveries,
      failedDeliveries,
      pendingDispatch,
      availableDrivers,
      availableVehicles,
      vehiclesInMaintenance,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
