import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Users, Building2 } from 'lucide-react'

interface PageProps {
  params: Promise<{ orgSlug: string }>
}

const ROLE_BADGE: Record<string, string> = {
  OWNER: 'bg-purple-50 text-purple-700',
  ADMIN: 'bg-blue-50 text-blue-700',
  DISPATCHER: 'bg-green-50 text-green-700',
  FLEET_MANAGER: 'bg-orange-50 text-orange-700',
  DRIVER: 'bg-gray-100 text-gray-700',
}

export default async function SettingsPage({ params }: PageProps) {
  const { orgSlug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const org = await db.organization.findUnique({ where: { slug: orgSlug } })
  if (!org) redirect('/login')

  const membership = await db.membership.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId: org.id } },
  })
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) redirect(`/${orgSlug}`)

  const members = await db.membership.findMany({
    where: { organizationId: org.id },
    include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <>
      <Header title="Settings" subtitle="Organization settings and team management" />
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl space-y-6">
        {/* Organization */}
        <Card className="border-[#E2E8F0] shadow-none">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#64748B]" />
              Organization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Name</p>
                <p className="text-sm text-[#0F172A] mt-1 font-medium">{org.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Slug</p>
                <p className="text-sm text-[#0F172A] mt-1 font-mono">{org.slug}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Created</p>
                <p className="text-sm text-[#0F172A] mt-1">{new Date(org.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Members</p>
                <p className="text-sm text-[#0F172A] mt-1">{members.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Team members */}
        <Card className="border-[#E2E8F0] shadow-none">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-[#64748B]" />
              Team Members
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[#E2E8F0]">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-4 px-6 py-3">
                  <div className="h-9 w-9 rounded-full bg-[#2563EB]/10 flex items-center justify-center text-sm font-bold text-[#2563EB] shrink-0">
                    {m.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0F172A]">{m.user.name}</p>
                    <p className="text-xs text-[#64748B]">{m.user.email}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_BADGE[m.role] ?? 'bg-gray-100 text-gray-700'}`}>
                    {m.role.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Permissions reference */}
        <Card className="border-[#E2E8F0] shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Role Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0]">
                    <th className="text-left py-2 pr-4 text-[#64748B] font-medium">Permission</th>
                    {['OWNER', 'ADMIN', 'DISPATCHER', 'FLEET_MANAGER', 'DRIVER'].map(r => (
                      <th key={r} className="text-center py-2 px-2 text-[#64748B] font-medium">{r.replace(/_/g,' ')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['deliveries.create', true, true, true, false, false],
                    ['deliveries.dispatch', true, true, true, false, false],
                    ['deliveries.update', true, true, true, false, true],
                    ['drivers.manage', true, true, false, false, false],
                    ['vehicles.manage', true, true, false, true, false],
                    ['maintenance.manage', true, true, false, true, false],
                    ['customers.manage', true, true, false, false, false],
                    ['audit.read', true, true, false, false, false],
                    ['users.manage', true, true, false, false, false],
                  ].map(([perm, ...roles]) => (
                    <tr key={perm as string} className="border-b border-[#F1F5F9] last:border-0">
                      <td className="py-2 pr-4 font-mono text-[#0F172A]">{perm}</td>
                      {(roles as boolean[]).map((has, i) => (
                        <td key={i} className="text-center py-2 px-2">
                          {has ? <span className="text-[#16A34A]">✓</span> : <span className="text-[#CBD5E1]">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
