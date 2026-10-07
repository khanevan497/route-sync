import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Wrench } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface PageProps {
  params: Promise<{ orgSlug: string }>
}

const TYPE_LABEL: Record<string, string> = {
  OIL_SERVICE: 'Oil Service',
  INSPECTION: 'Inspection',
  TIRE_REPLACEMENT: 'Tire Replacement',
  REPAIR: 'Repair',
  OTHER: 'Other',
}

export default async function MaintenancePage({ params }: PageProps) {
  const { orgSlug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const org = await db.organization.findUnique({ where: { slug: orgSlug } })
  if (!org) redirect('/login')

  const records = await db.maintenanceRecord.findMany({
    where: { organizationId: org.id },
    include: {
      vehicle: { select: { registrationNumber: true, make: true, model: true } },
    },
    orderBy: { performedAt: 'desc' },
    take: 50,
  })

  return (
    <>
      <Header title="Maintenance" subtitle={`${records.length} maintenance records`} />

      <div className="flex-1 overflow-y-auto p-6">
        <Card className="border-[#E2E8F0] shadow-none">
          <CardContent className="p-0">
            {records.length === 0 ? (
              <div className="text-center py-12 text-[#64748B]">
                <Wrench className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No maintenance records. Log maintenance via the API.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Vehicle</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Type</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Description</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Mileage</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Cost</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Performed</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Next Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => {
                      const isDue = r.nextDueAt && new Date(r.nextDueAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                      return (
                        <tr key={r.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                          <td className="py-3 px-4 font-mono text-[#0F172A]">
                            {r.vehicle.registrationNumber}
                            <span className="text-[#64748B] ml-1 font-sans text-xs">{r.vehicle.make} {r.vehicle.model}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded text-xs">
                              {TYPE_LABEL[r.type]}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[#64748B] max-w-xs truncate">{r.description}</td>
                          <td className="py-3 px-4 text-[#64748B]">{r.mileage.toLocaleString()} mi</td>
                          <td className="py-3 px-4 text-[#64748B]">
                            {r.cost ? `$${Number(r.cost).toFixed(2)}` : '—'}
                          </td>
                          <td className="py-3 px-4 text-[#64748B] text-xs">
                            {new Date(r.performedAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            {r.nextDueAt ? (
                              <span className={isDue ? 'text-[#DC2626] font-medium' : 'text-[#64748B]'}>
                                {new Date(r.nextDueAt).toLocaleDateString()}
                                {isDue && ' ⚠️'}
                              </span>
                            ) : '—'}
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
