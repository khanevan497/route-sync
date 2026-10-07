import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Car } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { CreateVehicleDialog } from '@/components/shared/create-vehicle-dialog'

interface PageProps {
  params: Promise<{ orgSlug: string }>
}

const STATUS_BADGE: Record<string, string> = {
  AVAILABLE: 'bg-green-50 text-green-700 border-green-200',
  ASSIGNED: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_MAINTENANCE: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  OUT_OF_SERVICE: 'bg-red-50 text-red-700 border-red-200',
}

const TYPE_ICON: Record<string, string> = {
  VAN: '🚐',
  TRUCK: '🚚',
  MOTORCYCLE: '🏍️',
  CAR: '🚗',
  OTHER: '🚛',
}

export default async function VehiclesPage({ params }: PageProps) {
  const { orgSlug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const org = await db.organization.findUnique({ where: { slug: orgSlug } })
  if (!org) redirect('/login')

  const vehicles = await db.vehicle.findMany({
    where: { organizationId: org.id },
    include: {
      _count: {
        select: {
          maintenanceRecords: true,
          deliveries: { where: { status: { in: ['ASSIGNED', 'IN_TRANSIT'] } } },
        },
      },
    },
    orderBy: { registrationNumber: 'asc' },
  })

  return (
    <>
      <Header
        title="Vehicles"
        subtitle={`${vehicles.length} vehicles in fleet`}
        actions={<CreateVehicleDialog orgSlug={orgSlug} />}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <Card className="border-[#E2E8F0] shadow-none">
          <CardContent className="p-0">
            {vehicles.length === 0 ? (
              <div className="text-center py-12 text-[#64748B]">
                <Car className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No vehicles yet. Add vehicles via the API.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Registration</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Type</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Make & Model</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Year</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Mileage</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Active Jobs</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Maintenance</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((v) => (
                      <tr key={v.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-[#0F172A]">{v.registrationNumber}</td>
                        <td className="py-3 px-4 text-[#64748B]">
                          <span className="flex items-center gap-1">
                            {TYPE_ICON[v.type]} {v.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#64748B]">{v.make} {v.model}</td>
                        <td className="py-3 px-4 text-[#64748B]">{v.year}</td>
                        <td className="py-3 px-4 text-[#64748B]">{v.mileage.toLocaleString()} mi</td>
                        <td className="py-3 px-4">
                          {v._count.deliveries > 0 ? (
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
                              {v._count.deliveries} active
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-4 text-[#64748B] text-xs">{v._count.maintenanceRecords} records</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[v.status]}`}>
                            {v.status.replace(/_/g, ' ')}
                          </span>
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
