import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Navigation2, Package, Car, User } from 'lucide-react'

interface Props {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}

export default async function DriverLayout({ children, params }: Props) {
  const { orgSlug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const org = await db.organization.findUnique({ where: { slug: orgSlug } })
  if (!org) redirect('/login')

  const membership = await db.membership.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId: org.id } },
  })
  if (!membership) redirect('/login')

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col max-w-md mx-auto">
      {/* Top bar */}
      <header className="bg-[#0F172A] text-white px-4 py-3 flex items-center gap-2 sticky top-0 z-10">
        <div className="bg-[#0D9488] rounded p-1">
          <Navigation2 className="h-4 w-4" />
        </div>
        <span className="font-bold text-sm">RouteSync Driver</span>
        <span className="ml-auto text-xs text-white/50">{org.name}</span>
      </header>

      {/* Content */}
      <main className="flex-1 pb-20">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-[#E2E8F0] px-2 py-2 grid grid-cols-3 gap-1">
        {[
          { href: `/driver/${orgSlug}`, label: 'Today', icon: Package },
          { href: `/driver/${orgSlug}/deliveries`, label: 'All Deliveries', icon: Car },
          { href: `/driver/${orgSlug}/profile`, label: 'Profile', icon: User },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-1 py-1.5 rounded-lg text-[#64748B] hover:text-[#0D9488] hover:bg-teal-50 transition-colors"
          >
            <Icon className="h-5 w-5" />
            <span className="text-xs font-medium">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
