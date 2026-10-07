import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Package } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { CreateDeliveryDialog } from '@/components/deliveries/create-delivery-dialog'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<{ status?: string; page?: string }>
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  PENDING_DISPATCH: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  ASSIGNED: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_TRANSIT: 'bg-purple-50 text-purple-700 border-purple-200',
  DELIVERED: 'bg-green-50 text-green-700 border-green-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-gray-50 text-gray-500 border-gray-200',
}

const PRIORITY_DOT: Record<string, string> = {
  LOW: 'bg-gray-400',
  NORMAL: 'bg-blue-400',
  HIGH: 'bg-orange-400',
  URGENT: 'bg-red-500',
}

export default async function DeliveriesPage({ params, searchParams }: PageProps) {
  const { orgSlug } = await params
  const { status, page: pageStr } = await searchParams
  const page = parseInt(pageStr ?? '1')
  const limit = 20

  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const org = await db.organization.findUnique({ where: { slug: orgSlug } })
  if (!org) redirect('/login')

  const where = {
    organizationId: org.id,
    ...(status ? { status: status as any } : {}),
  }

  const [deliveries, total, customers] = await Promise.all([
    db.delivery.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        driver: { select: { name: true } },
        vehicle: { select: { registrationNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.delivery.count({ where }),
    db.customer.findMany({
      where: { organizationId: org.id },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const totalPages = Math.ceil(total / limit)

  const statusFilters = [
    { label: 'All', value: '' },
    { label: 'Draft', value: 'DRAFT' },
    { label: 'Pending', value: 'PENDING_DISPATCH' },
    { label: 'Assigned', value: 'ASSIGNED' },
    { label: 'In Transit', value: 'IN_TRANSIT' },
    { label: 'Delivered', value: 'DELIVERED' },
    { label: 'Failed', value: 'FAILED' },
  ]

  return (
    <>
      <Header
        title="Deliveries"
        subtitle={`${total} total deliveries`}
        actions={<CreateDeliveryDialog orgSlug={orgSlug} customers={customers} />}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Status filters */}
        <div className="flex gap-2 flex-wrap">
          {statusFilters.map((f) => (
            <Link
              key={f.value}
              href={`/${orgSlug}/deliveries${f.value ? `?status=${f.value}` : ''}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                (status ?? '') === f.value
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:border-[#2563EB] hover:text-[#2563EB]'
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        <Card className="border-[#E2E8F0] shadow-none">
          <CardContent className="p-0">
            {deliveries.length === 0 ? (
              <div className="text-center py-12 text-[#64748B]">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No deliveries found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">ID</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Customer</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Driver</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Vehicle</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Priority</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Status</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Scheduled</th>
                      <th className="text-left py-3 px-4 text-[#64748B] font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d) => (
                      <tr key={d.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer">
                        <td className="py-3 px-4">
                          <Link href={`/${orgSlug}/deliveries/${d.id}`} className="font-mono text-xs text-[#2563EB] hover:underline">
                            {d.id.slice(-8).toUpperCase()}
                          </Link>
                        </td>
                        <td className="py-3 px-4 font-medium text-[#0F172A]">{d.customer.name}</td>
                        <td className="py-3 px-4 text-[#64748B]">{d.driver?.name ?? <span className="text-[#CBD5E1]">Unassigned</span>}</td>
                        <td className="py-3 px-4 text-[#64748B]">{d.vehicle?.registrationNumber ?? <span className="text-[#CBD5E1]">—</span>}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <div className={`h-2 w-2 rounded-full ${PRIORITY_DOT[d.priority]}`} />
                            <span className="text-[#64748B] text-xs">{d.priority}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[d.status]}`}>
                            {d.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#64748B] text-xs">
                          {d.scheduledDate ? new Date(d.scheduledDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 px-4 text-[#64748B] text-xs">
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#64748B]">
              Page {page} of {totalPages} ({total} total)
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/${orgSlug}/deliveries?${status ? `status=${status}&` : ''}page=${page - 1}`}
                  className="px-3 py-1.5 text-sm border border-[#E2E8F0] rounded-lg hover:bg-gray-50"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/${orgSlug}/deliveries?${status ? `status=${status}&` : ''}page=${page + 1}`}
                  className="px-3 py-1.5 text-sm border border-[#E2E8F0] rounded-lg hover:bg-gray-50"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
