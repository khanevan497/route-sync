import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface PageProps {
  params: Promise<{ orgSlug: string }>
}

const STATUS_BADGE: Record<string, string> = {
  PLANNED: 'bg-blue-50 text-blue-700 border-blue-200',
  ACTIVE: 'bg-green-50 text-green-700 border-green-200',
  COMPLETED: 'bg-gray-50 text-gray-600 border-gray-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
}

export default async function RoutesPage({ params }: PageProps) {
  const { orgSlug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const org = await db.organization.findUnique({ where: { slug: orgSlug } })
  if (!org) redirect('/login')

  const routes = await db.route.findMany({
    where: { organizationId: org.id },
    include: {
      driver: { select: { name: true } },
      vehicle: { select: { registrationNumber: true } },
      _count: { select: { stops: true, deliveries: true } },
    },
    orderBy: { date: 'desc' },
  })

  return (
    <>
      <Header title="Routes" subtitle={`${routes.length} routes`} />

      <div className="flex-1 overflow-y-auto p-6">
        <Card className="border-[#E2E8F0] shadow-none">
          <CardContent className="p-0">
            {routes.length === 0 ? (
              <div className="text-center py-12 text-[#64748B]">
                <MapPin className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No routes yet. Create routes via the API.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Name</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Date</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Driver</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Vehicle</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Stops</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Deliveries</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routes.map((r) => (
                      <tr key={r.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                        <td className="py-3 px-4 font-medium text-[#0F172A]">{r.name}</td>
                        <td className="py-3 px-4 text-[#64748B]">{new Date(r.date).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-[#64748B]">{r.driver?.name ?? '—'}</td>
                        <td className="py-3 px-4 text-[#64748B] font-mono text-xs">{r.vehicle?.registrationNumber ?? '—'}</td>
                        <td className="py-3 px-4 text-[#64748B]">{r._count.stops}</td>
                        <td className="py-3 px-4 text-[#64748B]">{r._count.deliveries}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[r.status]}`}>
                            {r.status}
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
