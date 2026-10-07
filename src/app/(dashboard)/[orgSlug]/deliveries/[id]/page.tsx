import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { DeliveryDetail } from '@/components/deliveries/delivery-detail'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface PageProps {
  params: Promise<{ orgSlug: string; id: string }>
}

export default async function DeliveryDetailPage({ params }: PageProps) {
  const { orgSlug, id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const org = await db.organization.findUnique({ where: { slug: orgSlug } })
  if (!org) redirect('/login')

  const membership = await db.membership.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId: org.id } },
  })
  if (!membership) redirect('/login')

  const delivery = await db.delivery.findFirst({
    where: { id, organizationId: org.id },
    include: {
      customer: { include: { addresses: true } },
      driver: true,
      vehicle: true,
      route: { include: { stops: { orderBy: { stopOrder: 'asc' } } } },
      proofOfDelivery: true,
    },
  })
  if (!delivery) notFound()

  const [drivers, vehicles, auditLogs] = await Promise.all([
    db.driver.findMany({
      where: { organizationId: org.id, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    }),
    db.vehicle.findMany({
      where: { organizationId: org.id, status: { in: ['AVAILABLE', 'ASSIGNED'] } },
      orderBy: { registrationNumber: 'asc' },
    }),
    db.auditLog.findMany({
      where: { organizationId: org.id, resourceType: 'Delivery', resourceId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])

  return (
    <>
      <Header
        title={`Delivery ${id.slice(-8).toUpperCase()}`}
        subtitle={`${delivery.customer.name} · ${delivery.status.replace(/_/g, ' ')}`}
        actions={
          <Link
            href={`/${orgSlug}/deliveries`}
            className="flex items-center gap-1 text-sm text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <DeliveryDetail
          delivery={JSON.parse(JSON.stringify(delivery))}
          drivers={JSON.parse(JSON.stringify(drivers))}
          vehicles={JSON.parse(JSON.stringify(vehicles))}
          auditLogs={JSON.parse(JSON.stringify(auditLogs))}
          orgSlug={orgSlug}
          userRole={membership.role}
        />
      </div>
    </>
  )
}
