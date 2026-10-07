'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Navigation2,
  LayoutDashboard,
  Package,
  Users,
  Car,
  MapPin,
  Wrench,
  UserCircle,
  Radio,
  FileText,
  Settings,
  LogOut,
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  orgSlug: string
  orgName: string
  userName: string
  userRole?: string
}

const navItems = (orgSlug: string) => [
  { label: 'Dashboard', href: `/${orgSlug}`, icon: LayoutDashboard },
  { label: 'Deliveries', href: `/${orgSlug}/deliveries`, icon: Package },
  { label: 'Dispatch', href: `/${orgSlug}/dispatch`, icon: Radio },
  { label: 'Routes', href: `/${orgSlug}/routes`, icon: MapPin },
  { label: 'Drivers', href: `/${orgSlug}/drivers`, icon: Users },
  { label: 'Vehicles', href: `/${orgSlug}/vehicles`, icon: Car },
  { label: 'Maintenance', href: `/${orgSlug}/maintenance`, icon: Wrench },
  { label: 'Customers', href: `/${orgSlug}/customers`, icon: UserCircle },
  { label: 'Audit Logs', href: `/${orgSlug}/audit-logs`, icon: FileText },
  { label: 'Settings', href: `/${orgSlug}/settings`, icon: Settings },
]

export function Sidebar({ orgSlug, orgName, userName, userRole }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="w-64 min-h-screen bg-[#0F172A] text-white flex flex-col shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-white/10">
        <div className="bg-[#0D9488] rounded-lg p-1.5">
          <Navigation2 className="h-5 w-5 text-white" />
        </div>
        <span className="font-bold text-lg tracking-tight">RouteSync</span>
      </div>

      {/* Org name */}
      <div className="px-6 py-3 border-b border-white/10">
        <p className="text-xs text-white/40 uppercase tracking-wider font-medium">Organization</p>
        <p className="text-sm font-medium text-white mt-0.5 truncate">{orgName}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems(orgSlug).map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href ||
            (item.href !== `/${orgSlug}` && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[#0D9488] text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/10',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User + Signout */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="h-8 w-8 rounded-full bg-[#0D9488] flex items-center justify-center text-sm font-bold shrink-0">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
            {userRole && (
              <p className="text-xs text-white/40 truncate capitalize">
                {userRole.toLowerCase().replace(/_/g, ' ')}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
