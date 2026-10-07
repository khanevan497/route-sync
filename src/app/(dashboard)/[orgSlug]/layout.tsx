import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'

interface DashboardLayoutProps {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}

export default async function DashboardLayout({ children, params }: DashboardLayoutProps) {
  const { orgSlug } = await params
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const org = await db.organization.findUnique({ where: { slug: orgSlug } })
  if (!org) notFound()

  const membership = await db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId: org.id,
      },
    },
  })

  if (!membership) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar
        orgSlug={orgSlug}
        orgName={org.name}
        userName={session.user.name ?? 'User'}
        userRole={membership.role}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}
