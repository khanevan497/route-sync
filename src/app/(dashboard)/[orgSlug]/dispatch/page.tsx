import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { DispatchBoard } from '@/components/dispatch/dispatch-board'

interface PageProps {
  params: Promise<{ orgSlug: string }>
}

export default async function DispatchPage({ params }: PageProps) {
  const { orgSlug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const org = await db.organization.findUnique({ where: { slug: orgSlug } })
  if (!org) redirect('/login')

  const membership = await db.membership.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId: org.id } },
  })
  if (!membership) redirect('/login')

  const [pending, assigned, inTransit, failed, drivers, vehicles] = await Promise.all([
    db.delivery.findMany({
      where: { organizationId: org.id, status: 'PENDING_DISPATCH' },
      include: { customer: { select: { id: true, name: true } } },
      orderBy: [{ priority: 'desc' }, { scheduledDate: 'asc' }],
    }),
    db.delivery.findMany({
      where: { organizationId: org.id, status: 'ASSIGNED' },
      include: {
        customer: { select: { id: true, name: true } },
        driver: { select: { id: true, name: true } },
        vehicle: { select: { id: true, registrationNumber: true, make: true, model: true } },
      },
      orderBy: { scheduledDate: 'asc' },
    }),
    db.delivery.findMany({
      where: { organizationId: org.id, status: 'IN_TRANSIT' },
      include: {
        customer: { select: { id: true, name: true } },
        driver: { select: { id: true, name: true } },
        vehicle: { select: { id: true, registrationNumber: true, make: true, model: true } },
      },
      orderBy: { updatedAt: 'asc' },
    }),
    db.delivery.findMany({
      where: { organizationId: org.id, status: 'FAILED' },
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
    db.driver.findMany({
      where: { organizationId: org.id, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    }),
    db.vehicle.findMany({
      where: { organizationId: org.id, status: { in: ['AVAILABLE', 'ASSIGNED'] } },
      orderBy: { registrationNumber: 'asc' },
    }),
  ])

  return (
    <>
      <Header
        title="Dispatch Board"
        subtitle={`${pending.length} pending • ${assigned.length} assigned • ${inTransit.length} in transit`}
      />
      <div className="flex-1 overflow-hidden">
        <DispatchBoard
          orgSlug={orgSlug}
          pending={JSON.parse(JSON.stringify(pending))}
          assigned={JSON.parse(JSON.stringify(assigned))}
          inTransit={JSON.parse(JSON.stringify(inTransit))}
          failed={JSON.parse(JSON.stringify(failed))}
          drivers={JSON.parse(JSON.stringify(drivers))}
          vehicles={JSON.parse(JSON.stringify(vehicles))}
        />
      </div>
    </>
  )
}
