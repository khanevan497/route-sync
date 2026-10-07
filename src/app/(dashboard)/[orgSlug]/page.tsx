import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import {
  Package, Truck, Users, Car, CheckCircle2, AlertCircle, Clock, Wrench,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardStats } from '@/types'

interface PageProps {
  params: Promise<{ orgSlug: string }>
}

async function getDashboardStats(orgId: string): Promise<DashboardStats> {
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
    db.delivery.count({ where: { organizationId: orgId, scheduledDate: { gte: today, lt: tomorrow } } }),
    db.delivery.count({ where: { organizationId: orgId, status: { in: ['ASSIGNED', 'IN_TRANSIT'] } } }),
    db.delivery.count({ where: { organizationId: orgId, status: 'DELIVERED', updatedAt: { gte: today } } }),
    db.delivery.count({ where: { organizationId: orgId, status: 'FAILED' } }),
    db.delivery.count({ where: { organizationId: orgId, status: 'PENDING_DISPATCH' } }),
    db.driver.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
    db.vehicle.count({ where: { organizationId: orgId, status: 'AVAILABLE' } }),
    db.vehicle.count({ where: { organizationId: orgId, status: 'IN_MAINTENANCE' } }),
  ])

  return {
    todayDeliveries,
    activeDeliveries,
    completedDeliveries,
    failedDeliveries,
    pendingDispatch,
    availableDrivers,
    availableVehicles,
    vehiclesInMaintenance,
  }
}

async function getRecentDeliveries(orgId: string) {
  return db.delivery.findMany({
    where: { organizationId: orgId },
    include: {
      customer: { select: { name: true } },
      driver: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
  })
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING_DISPATCH: 'bg-yellow-100 text-yellow-700',
  ASSIGNED: 'bg-blue-100 text-blue-700',
  IN_TRANSIT: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'text-gray-500',
  NORMAL: 'text-blue-500',
  HIGH: 'text-orange-500',
  URGENT: 'text-red-500',
}

export default async function DashboardPage({ params }: PageProps) {
  const { orgSlug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const org = await db.organization.findUnique({ where: { slug: orgSlug } })
  if (!org) redirect('/login')

  const [stats, recentDeliveries] = await Promise.all([
    getDashboardStats(org.id),
    getRecentDeliveries(org.id),
  ])

  const statCards = [
    { label: "Today's Deliveries", value: stats.todayDeliveries, icon: Package, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Active Deliveries', value: stats.activeDeliveries, icon: Truck, color: 'text-purple-500', bg: 'bg-purple-50' },
    { label: 'Completed Today', value: stats.completedDeliveries, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50' },
    { label: 'Pending Dispatch', value: stats.pendingDispatch, icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-50' },
    { label: 'Failed Deliveries', value: stats.failedDeliveries, icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'Active Drivers', value: stats.availableDrivers, icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { label: 'Available Vehicles', value: stats.availableVehicles, icon: Car, color: 'text-teal-500', bg: 'bg-teal-50' },
    { label: 'In Maintenance', value: stats.vehiclesInMaintenance, icon: Wrench, color: 'text-orange-500', bg: 'bg-orange-50' },
  ]

  return (
    <>
      <Header
        title="Dashboard"
        subtitle={`Welcome back — ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon
            return (
              <Card key={card.label} className="border-[#E2E8F0] shadow-none">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[#64748B]">{card.label}</p>
                      <p className="text-3xl font-bold text-[#0F172A] mt-1">{card.value}</p>
                    </div>
                    <div className={`${card.bg} p-3 rounded-xl`}>
                      <Icon className={`h-5 w-5 ${card.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Recent deliveries */}
        <Card className="border-[#E2E8F0] shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-[#0F172A]">Recent Deliveries</CardTitle>
          </CardHeader>
          <CardContent>
            {recentDeliveries.length === 0 ? (
              <div className="text-center py-8 text-[#64748B]">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No deliveries yet. Create your first delivery to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0]">
                      <th className="text-left py-2 px-3 text-[#64748B] font-medium">ID</th>
                      <th className="text-left py-2 px-3 text-[#64748B] font-medium">Customer</th>
                      <th className="text-left py-2 px-3 text-[#64748B] font-medium">Driver</th>
                      <th className="text-left py-2 px-3 text-[#64748B] font-medium">Priority</th>
                      <th className="text-left py-2 px-3 text-[#64748B] font-medium">Status</th>
                      <th className="text-left py-2 px-3 text-[#64748B] font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentDeliveries.map((d) => (
                      <tr key={d.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-gray-50">
                        <td className="py-3 px-3 font-mono text-xs text-[#64748B]">{d.id.slice(-8)}</td>
                        <td className="py-3 px-3 font-medium text-[#0F172A]">{d.customer.name}</td>
                        <td className="py-3 px-3 text-[#64748B]">{d.driver?.name ?? '—'}</td>
                        <td className="py-3 px-3">
                          <span className={`font-medium text-xs ${PRIORITY_COLORS[d.priority]}`}>{d.priority}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[d.status]}`}>
                            {d.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#64748B] text-xs">
                          {new Date(d.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
