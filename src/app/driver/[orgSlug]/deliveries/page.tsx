import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Package, CheckCircle2, AlertCircle } from 'lucide-react'

interface PageProps {
  params: Promise<{ orgSlug: string }>
}

const STATUS_COLORS: Record<string, string> = {
  ASSIGNED: 'bg-blue-50 text-blue-700',
  IN_TRANSIT: 'bg-purple-50 text-purple-700',
  DELIVERED: 'bg-green-50 text-green-700',
  FAILED: 'bg-red-50 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
}

export default async function DriverDeliveriesPage({ params }: PageProps) {
  const { orgSlug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const org = await db.organization.findUnique({ where: { slug: orgSlug } })
  if (!org) redirect('/login')

  const driver = await db.driver.findFirst({
    where: { organizationId: org.id, userId: session.user.id },
  })
  if (!driver) return <div className="p-6 text-[#64748B]">No driver profile found.</div>

  const deliveries = await db.delivery.findMany({
    where: { organizationId: org.id, driverId: driver.id },
    include: { customer: { select: { name: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })

  const grouped = {
    active: deliveries.filter(d => ['ASSIGNED', 'IN_TRANSIT'].includes(d.status)),
    completed: deliveries.filter(d => d.status === 'DELIVERED'),
    failed: deliveries.filter(d => d.status === 'FAILED'),
  }

  function DeliveryItem({ d }: { d: typeof deliveries[0] }) {
    return (
      <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-[#E2E8F0]">
        <div>
          <p className="text-sm font-medium text-[#0F172A]">{d.customer.name}</p>
          <p className="text-xs text-[#64748B]">
            {d.scheduledDate ? new Date(d.scheduledDate).toLocaleDateString() : 'No date'}
          </p>
        </div>
        <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[d.status]}`}>
          {d.status.replace('_', ' ')}
        </span>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5">
      {grouped.active.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Active</h2>
          <div className="space-y-2">
            {grouped.active.map(d => <DeliveryItem key={d.id} d={d} />)}
          </div>
        </section>
      )}

      {grouped.completed.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" />
            Completed ({grouped.completed.length})
          </h2>
          <div className="space-y-2">
            {grouped.completed.slice(0, 10).map(d => <DeliveryItem key={d.id} d={d} />)}
          </div>
        </section>
      )}

      {grouped.failed.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
            Failed ({grouped.failed.length})
          </h2>
          <div className="space-y-2">
            {grouped.failed.slice(0, 10).map(d => <DeliveryItem key={d.id} d={d} />)}
          </div>
        </section>
      )}

      {deliveries.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-10 w-10 mx-auto mb-3 text-[#CBD5E1]" />
          <p className="text-[#64748B] text-sm">No deliveries yet.</p>
        </div>
      )}
    </div>
  )
}
