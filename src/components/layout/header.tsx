'use client'

import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#E2E8F0]">
      <div>
        <h1 className="text-xl font-semibold text-[#0F172A]">{title}</h1>
        {subtitle && <p className="text-sm text-[#64748B] mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <Button variant="ghost" size="icon" className="text-[#64748B]">
          <Bell className="h-5 w-5" />
        </Button>
      </div>
    </header>
  )
}
