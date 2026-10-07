import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Users, Phone, CreditCard } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { CreateDriverDialog } from '@/components/shared/create-driver-dialog'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ orgSlug: string }>
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-50 text-green-700 border-green-200',
  INACTIVE: 'bg-gray-50 text-gray-600 border-gray-200',
  SUSPENDED: 'bg-red-50 text-red-700 border-red-200',
}

export default async function DriversPage({ params }: PageProps) {
  const { orgSlug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const org = await db.organization.findUnique({ where: { slug: orgSlug } })
  if (!org) redirect('/login')

  const drivers = await db.driver.findMany({
    where: { organizationId: org.id },
    include: {
      _count: {
        select: {
          deliveries: { where: { status: { in: ['ASSIGNED', 'IN_TRANSIT'] } } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return (
    <>
      <Header
        title="Drivers"
        subtitle={`${drivers.length} drivers registered`}
        actions={<CreateDriverDialog orgSlug={orgSlug} />}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <Card className="border-[#E2E8F0] shadow-none">
          <CardContent className="p-0">
            {drivers.length === 0 ? (
              <div className="text-center py-12 text-[#64748B]">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No drivers yet. Add your first driver via the API.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Name</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Email</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Phone</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">License</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">License Expiry</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Active Jobs</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((d) => {
                      const isExpiringSoon = d.licenseExpiry && new Date(d.licenseExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                      return (
                        <tr key={d.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                          <td className="py-3 px-4 font-medium text-[#0F172A]">{d.name}</td>
                          <td className="py-3 px-4 text-[#64748B]">{d.email}</td>
                          <td className="py-3 px-4 text-[#64748B]">
                            {d.phone ? (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {d.phone}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-[#64748B]">{d.licenseNumber}</td>
                          <td className="py-3 px-4">
                            <span className={isExpiringSoon ? 'text-[#DC2626] font-medium' : 'text-[#64748B]'}>
                              {new Date(d.licenseExpiry).toLocaleDateString()}
                              {isExpiringSoon && ' ⚠️'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[#64748B]">
                            {d._count.deliveries > 0 ? (
                              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
                                {d._count.deliveries} active
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[d.status]}`}>
                              {d.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
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
