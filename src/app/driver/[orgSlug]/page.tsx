import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { DriverTodayView } from '@/components/driver/driver-today-view'

interface PageProps {
  params: Promise<{ orgSlug: string }>
}

export default async function DriverTodayPage({ params }: PageProps) {
  const { orgSlug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const org = await db.organization.findUnique({ where: { slug: orgSlug } })
  if (!org) redirect('/login')

  // Find the driver profile linked to this user
  const driver = await db.driver.findFirst({
    where: { organizationId: org.id, userId: session.user.id },
  })

  if (!driver) {
    return (
      <div className="p-6 text-center">
        <p className="text-[#64748B]">No driver profile found for your account.</p>
        <p className="text-xs text-[#94a3b8] mt-2">Contact your dispatcher to link your account.</p>
      </div>
    )
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todayDeliveries = await db.delivery.findMany({
    where: {
      organizationId: org.id,
      driverId: driver.id,
      status: { in: ['ASSIGNED', 'IN_TRANSIT'] },
      OR: [
        { scheduledDate: { gte: today, lt: tomorrow } },
        { scheduledDate: null },
      ],
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      vehicle: { select: { id: true, registrationNumber: true, make: true, model: true } },
    },
    orderBy: [{ priority: 'desc' }, { scheduledDate: 'asc' }],
  })

  return (
    <DriverTodayView
      driver={JSON.parse(JSON.stringify(driver))}
      deliveries={JSON.parse(JSON.stringify(todayDeliveries))}
      orgSlug={orgSlug}
    />
  )
}
