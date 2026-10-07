import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { User, CreditCard, Calendar, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PageProps {
  params: Promise<{ orgSlug: string }>
}

export default async function DriverProfilePage({ params }: PageProps) {
  const { orgSlug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const org = await db.organization.findUnique({ where: { slug: orgSlug } })
  if (!org) redirect('/login')

  const driver = await db.driver.findFirst({
    where: { organizationId: org.id, userId: session.user.id },
  })
  if (!driver) return <div className="p-6 text-[#64748B]">No driver profile found.</div>

  const licenseExpiryDays = Math.ceil(
    (new Date(driver.licenseExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )
  const licenseExpiringSoon = licenseExpiryDays <= 30

  const [totalDeliveries, completedDeliveries] = await Promise.all([
    db.delivery.count({ where: { driverId: driver.id } }),
    db.delivery.count({ where: { driverId: driver.id, status: 'DELIVERED' } }),
  ])

  return (
    <div className="p-4 space-y-4">
      {/* Profile header */}
      <div className="bg-[#0F172A] text-white rounded-xl p-6 flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-[#2563EB] flex items-center justify-center text-2xl font-bold">
          {driver.name.charAt(0)}
        </div>
        <div>
          <p className="text-xl font-bold">{driver.name}</p>
          <p className="text-sm text-white/60">{driver.email}</p>
          <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${
            driver.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {driver.status}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-[#E2E8F0] shadow-none">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-[#0F172A]">{totalDeliveries}</p>
            <p className="text-xs text-[#64748B] mt-1">Total Deliveries</p>
          </CardContent>
        </Card>
        <Card className="border-[#E2E8F0] shadow-none">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-[#16A34A]">{completedDeliveries}</p>
            <p className="text-xs text-[#64748B] mt-1">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* License info */}
      <Card className={`border shadow-none ${licenseExpiringSoon ? 'border-orange-200 bg-orange-50' : 'border-[#E2E8F0]'}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-[#64748B]" />
            Driver&apos;s License
            {licenseExpiringSoon && (
              <span className="flex items-center gap-1 text-orange-600 ml-auto">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="text-xs">Expiring soon</span>
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[#64748B]">Number</span>
            <span className="font-mono font-medium">{driver.licenseNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748B]">Expiry</span>
            <span className={`font-medium ${licenseExpiringSoon ? 'text-orange-600' : 'text-[#0F172A]'}`}>
              {new Date(driver.licenseExpiry).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {licenseExpiringSoon && ` (${licenseExpiryDays}d)`}
            </span>
          </div>
        </CardContent>
      </Card>

      {driver.phone && (
        <Card className="border-[#E2E8F0] shadow-none">
          <CardContent className="pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-[#64748B]">Phone</span>
              <a href={`tel:${driver.phone}`} className="text-[#2563EB] font-medium">{driver.phone}</a>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
