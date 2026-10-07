import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { MapPin, Mail, Phone } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface PageProps {
  params: Promise<{ orgSlug: string }>
}

export default async function CustomersPage({ params }: PageProps) {
  const { orgSlug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const org = await db.organization.findUnique({ where: { slug: orgSlug } })
  if (!org) redirect('/login')

  const customers = await db.customer.findMany({
    where: { organizationId: org.id },
    include: {
      addresses: { where: { isDefault: true }, take: 1 },
      _count: { select: { deliveries: true } },
    },
    orderBy: { name: 'asc' },
  })

  return (
    <>
      <Header title="Customers" subtitle={`${customers.length} customers`} />

      <div className="flex-1 overflow-y-auto p-6">
        <Card className="border-[#E2E8F0] shadow-none">
          <CardContent className="p-0">
            {customers.length === 0 ? (
              <div className="text-center py-12 text-[#64748B]">
                <MapPin className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No customers yet. Add customers via the API.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Name</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Email</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Phone</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Default Address</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Total Deliveries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                        <td className="py-3 px-4 font-medium text-[#0F172A]">{c.name}</td>
                        <td className="py-3 px-4 text-[#64748B]">
                          {c.email ? (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {c.email}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-4 text-[#64748B]">
                          {c.phone ? (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {c.phone}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-4 text-[#64748B] text-xs">
                          {c.addresses[0] ? `${c.addresses[0].street}, ${c.addresses[0].city}` : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded-full text-xs">
                            {c._count.deliveries}
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
