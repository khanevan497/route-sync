'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Package, AlertCircle, Clock, Truck, RefreshCw, User, Car } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import type { Delivery, Driver, Vehicle, Customer } from '@prisma/client'

type DeliveryCard = Pick<Delivery, 'id' | 'status' | 'priority' | 'scheduledDate' | 'timeWindowStart' | 'timeWindowEnd' | 'failureReason' | 'deliveryAddress'> & {
  customer: Pick<Customer, 'id' | 'name'>
  driver?: Pick<Driver, 'id' | 'name'> | null
  vehicle?: Pick<Vehicle, 'id' | 'registrationNumber' | 'make' | 'model'> | null
}

interface DispatchBoardProps {
  orgSlug: string
  pending: DeliveryCard[]
  assigned: DeliveryCard[]
  inTransit: DeliveryCard[]
  failed: DeliveryCard[]
  drivers: Driver[]
  vehicles: Vehicle[]
}

const PRIORITY_COLORS = {
  LOW: 'bg-gray-100 text-gray-600 border-gray-200',
  NORMAL: 'bg-blue-50 text-blue-700 border-blue-200',
  HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
  URGENT: 'bg-red-50 text-red-700 border-red-200',
}

const PRIORITY_DOT = {
  LOW: 'bg-gray-400',
  NORMAL: 'bg-blue-400',
  HIGH: 'bg-orange-400',
  URGENT: 'bg-red-500',
}

function formatAddress(addr: unknown): string {
  if (!addr || typeof addr !== 'object') return 'Unknown address'
  const a = addr as Record<string, string>
  return [a.street, a.city, a.state].filter(Boolean).join(', ')
}

function formatWindow(start?: Date | string | null, end?: Date | string | null): string {
  if (!start) return ''
  const fmt = (d: Date | string) =>
    new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  if (!end) return fmt(start)
  return `${fmt(start)} – ${fmt(end)}`
}

function DeliveryKanbanCard({
  delivery,
  onAssign,
  showAssign,
}: {
  delivery: DeliveryCard
  onAssign?: (id: string) => void
  showAssign?: boolean
}) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-[#0F172A] text-sm truncate">{delivery.customer.name}</p>
          <p className="text-xs text-[#64748B] truncate mt-0.5">{formatAddress(delivery.deliveryAddress)}</p>
        </div>
        <span className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded border ${PRIORITY_COLORS[delivery.priority]}`}>
          {delivery.priority}
        </span>
      </div>

      {delivery.scheduledDate && (
        <div className="flex items-center gap-1 text-xs text-[#64748B]">
          <Clock className="h-3 w-3" />
          {new Date(delivery.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {formatWindow(delivery.timeWindowStart, delivery.timeWindowEnd) && (
            <span className="ml-1">{formatWindow(delivery.timeWindowStart, delivery.timeWindowEnd)}</span>
          )}
        </div>
      )}

      {delivery.driver && (
        <div className="flex items-center gap-1 text-xs text-[#64748B]">
          <User className="h-3 w-3" />
          {delivery.driver.name}
          {delivery.vehicle && (
            <span className="ml-1 text-[#94a3b8]">· {delivery.vehicle.registrationNumber}</span>
          )}
        </div>
      )}

      {delivery.failureReason && (
        <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {delivery.failureReason.replace(/_/g, ' ')}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs font-mono text-[#94a3b8]">{delivery.id.slice(-8)}</span>
        {showAssign && onAssign && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs px-2 border-[#2563EB] text-[#2563EB] hover:bg-[#2563EB] hover:text-white"
            onClick={() => onAssign(delivery.id)}
          >
            Assign
          </Button>
        )}
      </div>
    </div>
  )
}

function KanbanColumn({
  title,
  count,
  icon: Icon,
  color,
  children,
}: {
  title: string
  count: number
  icon: React.ElementType
  color: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px] flex-1">
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-t-lg border border-b-0 ${color}`}>
        <Icon className="h-4 w-4" />
        <span className="font-semibold text-sm">{title}</span>
        <span className="ml-auto bg-white/60 text-xs font-bold px-2 py-0.5 rounded-full">{count}</span>
      </div>
      <div className="flex-1 overflow-y-auto border border-[#E2E8F0] rounded-b-lg bg-[#F8FAFC] p-2 space-y-2 min-h-[400px] max-h-[calc(100vh-180px)]">
        {children}
      </div>
    </div>
  )
}

export function DispatchBoard({ orgSlug, pending, assigned, inTransit, failed, drivers, vehicles }: DispatchBoardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [selectedDriver, setSelectedDriver] = useState<string>('')
  const [selectedVehicle, setSelectedVehicle] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const handleAssign = async () => {
    if (!assigningId || !selectedDriver || !selectedVehicle) {
      toast.error('Please select both a driver and vehicle')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/${orgSlug}/deliveries/${assigningId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: selectedDriver, vehicleId: selectedVehicle }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Assignment failed')
      }

      toast.success('Delivery assigned successfully')
      setAssigningId(null)
      setSelectedDriver('')
      setSelectedVehicle('')
      startTransition(() => router.refresh())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Assignment failed')
    } finally {
      setSubmitting(false)
    }
  }

  const availableVehicles = vehicles.filter(v => v.status === 'AVAILABLE')

  return (
    <div className="h-full overflow-x-auto p-4">
      <div className="flex gap-4 min-w-max h-full">
        {/* Pending Dispatch */}
        <KanbanColumn
          title="Pending Dispatch"
          count={pending.length}
          icon={Clock}
          color="bg-yellow-50 border-yellow-200 text-yellow-800"
        >
          {pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-[#94a3b8]">
              <Package className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs">No pending deliveries</p>
            </div>
          ) : (
            pending.map(d => (
              <DeliveryKanbanCard
                key={d.id}
                delivery={d}
                showAssign
                onAssign={setAssigningId}
              />
            ))
          )}
        </KanbanColumn>

        {/* Assigned */}
        <KanbanColumn
          title="Assigned"
          count={assigned.length}
          icon={User}
          color="bg-blue-50 border-blue-200 text-blue-800"
        >
          {assigned.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-[#94a3b8]">
              <User className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs">No assigned deliveries</p>
            </div>
          ) : (
            assigned.map(d => (
              <DeliveryKanbanCard key={d.id} delivery={d} showAssign onAssign={setAssigningId} />
            ))
          )}
        </KanbanColumn>

        {/* In Transit */}
        <KanbanColumn
          title="In Transit"
          count={inTransit.length}
          icon={Truck}
          color="bg-purple-50 border-purple-200 text-purple-800"
        >
          {inTransit.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-[#94a3b8]">
              <Truck className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs">No deliveries in transit</p>
            </div>
          ) : (
            inTransit.map(d => (
              <DeliveryKanbanCard key={d.id} delivery={d} />
            ))
          )}
        </KanbanColumn>

        {/* Failed */}
        <KanbanColumn
          title="Failed"
          count={failed.length}
          icon={AlertCircle}
          color="bg-red-50 border-red-200 text-red-800"
        >
          {failed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-[#94a3b8]">
              <AlertCircle className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs">No failed deliveries</p>
            </div>
          ) : (
            failed.map(d => (
              <DeliveryKanbanCard key={d.id} delivery={d} showAssign onAssign={setAssigningId} />
            ))
          )}
        </KanbanColumn>
      </div>

      {/* Assign Modal */}
      <Dialog open={!!assigningId} onOpenChange={(open) => !open && setAssigningId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Delivery</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-[#64748B]" />
                Driver
              </Label>
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a driver…" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {drivers.length === 0 && (
                <p className="text-xs text-[#DC2626]">No active drivers available</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Car className="h-3.5 w-3.5 text-[#64748B]" />
                Vehicle
              </Label>
              <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a vehicle…" />
                </SelectTrigger>
                <SelectContent>
                  {availableVehicles.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.registrationNumber} — {v.make} {v.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableVehicles.length === 0 && (
                <p className="text-xs text-[#DC2626]">No available vehicles</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigningId(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
              onClick={handleAssign}
              disabled={submitting || !selectedDriver || !selectedVehicle}
            >
              {submitting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
