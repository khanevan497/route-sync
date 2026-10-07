import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { FileText } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<{ page?: string; resourceType?: string }>
}

const RESOURCE_COLORS: Record<string, string> = {
  Delivery: 'bg-blue-50 text-blue-700',
  Driver: 'bg-green-50 text-green-700',
  Vehicle: 'bg-purple-50 text-purple-700',
  Route: 'bg-orange-50 text-orange-700',
  MaintenanceRecord: 'bg-red-50 text-red-700',
}

export default async function AuditLogsPage({ params, searchParams }: PageProps) {
  const { orgSlug } = await params
  const { page: pageStr, resourceType } = await searchParams
  const page = parseInt(pageStr ?? '1')
  const limit = 50

  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const org = await db.organization.findUnique({ where: { slug: orgSlug } })
  if (!org) redirect('/login')

  const membership = await db.membership.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId: org.id } },
  })
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) redirect(`/${orgSlug}`)

  const where = {
    organizationId: org.id,
    ...(resourceType ? { resourceType } : {}),
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.auditLog.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  const resourceTypes = ['Delivery', 'Driver', 'Vehicle', 'Route', 'MaintenanceRecord']

  return (
    <>
      <Header title="Audit Logs" subtitle={`${total} events recorded`} />
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <Link
            href={`/${orgSlug}/audit-logs`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !resourceType ? 'bg-[#2563EB] text-white' : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:border-[#2563EB]'
            }`}
          >
            All
          </Link>
          {resourceTypes.map(rt => (
            <Link
              key={rt}
              href={`/${orgSlug}/audit-logs?resourceType=${rt}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                resourceType === rt ? 'bg-[#2563EB] text-white' : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:border-[#2563EB]'
              }`}
            >
              {rt.replace(/([A-Z])/g, ' $1').trim()}
            </Link>
          ))}
        </div>

        <Card className="border-[#E2E8F0] shadow-none">
          <CardContent className="p-0">
            {logs.length === 0 ? (
              <div className="text-center py-12 text-[#64748B]">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No audit events found.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E2E8F0]">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-4 px-4 py-3 hover:bg-[#F8FAFC] transition-colors">
                    <div className="shrink-0 mt-0.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${RESOURCE_COLORS[log.resourceType] ?? 'bg-gray-100 text-gray-700'}`}>
                        {log.resourceType.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#0F172A] font-medium">{log.action.replace(/\./g, ' → ')}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-[#94a3b8] font-mono">{log.resourceId.slice(-8)}</span>
                        {log.requestId && (
                          <span className="text-xs text-[#CBD5E1]">req:{log.requestId.slice(-6)}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-[#64748B]">
                        {new Date(log.createdAt).toLocaleString('en-US', {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#64748B]">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/${orgSlug}/audit-logs?page=${page - 1}${resourceType ? `&resourceType=${resourceType}` : ''}`}
                  className="px-3 py-1.5 text-sm border border-[#E2E8F0] rounded-lg hover:bg-gray-50"
                >Previous</Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/${orgSlug}/audit-logs?page=${page + 1}${resourceType ? `&resourceType=${resourceType}` : ''}`}
                  className="px-3 py-1.5 text-sm border border-[#E2E8F0] rounded-lg hover:bg-gray-50"
                >Next</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
