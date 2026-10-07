'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  MapPin, User, Car, Clock, AlertCircle, CheckCircle2,
  Package, FileText, RefreshCw, ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { getAvailableTransitions } from '@/lib/delivery-state-machine'
import type { Delivery, Driver, Vehicle, Customer, CustomerAddress, MemberRole, AuditLog, DeliveryStatus, FailureReason } from '@prisma/client'

type FullDelivery = Delivery & {
  customer: Customer & { addresses: CustomerAddress[] }
  driver: Driver | null
  vehicle: Vehicle | null
  proofOfDelivery: {
    id: string; recipientName: string; deliveredAt: Date | string; driverNotes?: string | null; signatureKey?: string | null; photoKey?: string | null
  } | null
}

interface Props {
  delivery: FullDelivery
  drivers: Driver[]
  vehicles: Vehicle[]
  auditLogs: AuditLog[]
  orgSlug: string
  userRole: MemberRole
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING_DISPATCH: 'bg-yellow-50 text-yellow-700',
  ASSIGNED: 'bg-blue-50 text-blue-700',
  IN_TRANSIT: 'bg-purple-50 text-purple-700',
  DELIVERED: 'bg-green-50 text-green-700',
  FAILED: 'bg-red-50 text-red-700',
  CANCELLED: 'bg-gray-50 text-gray-500',
}

const PRIORITY_BADGE: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  NORMAL: 'bg-blue-50 text-blue-700',
  HIGH: 'bg-orange-50 text-orange-700',
  URGENT: 'bg-red-50 text-red-700',
}

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  DRAFT: 'Draft',
  PENDING_DISPATCH: 'Pending Dispatch',
  ASSIGNED: 'Assigned',
  IN_TRANSIT: 'In Transit',
  DELIVERED: 'Delivered',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
}

const FAILURE_REASONS: { value: FailureReason; label: string }[] = [
  { value: 'CUSTOMER_UNAVAILABLE', label: 'Customer Unavailable' },
  { value: 'WRONG_ADDRESS', label: 'Wrong Address' },
  { value: 'DAMAGED_PACKAGE', label: 'Damaged Package' },
  { value: 'REFUSED_DELIVERY', label: 'Refused Delivery' },
  { value: 'VEHICLE_ISSUE', label: 'Vehicle Issue' },
  { value: 'OTHER', label: 'Other' },
]

function formatAddress(addr: unknown): string {
  if (!addr || typeof addr !== 'object') return 'Unknown'
  const a = addr as Record<string, string>
  return [a.street, a.city, a.state, a.postalCode, a.country].filter(Boolean).join(', ')
}

export function DeliveryDetail({ delivery, drivers, vehicles, auditLogs, orgSlug, userRole }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [showAssign, setShowAssign] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState<DeliveryStatus | null>(null)
  const [selectedDriver, setSelectedDriver] = useState(delivery.driverId ?? '')
  const [selectedVehicle, setSelectedVehicle] = useState(delivery.vehicleId ?? '')
  const [failureReason, setFailureReason] = useState<FailureReason | ''>('')
  const [failureNote, setFailureNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canDispatch = ['OWNER', 'ADMIN', 'DISPATCHER'].includes(userRole)
  const availableTransitions = getAvailableTransitions(delivery.status)

  const handleAssign = async () => {
    if (!selectedDriver || !selectedVehicle) {
      toast.error('Select both driver and vehicle')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/${orgSlug}/deliveries/${delivery.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: selectedDriver, vehicleId: selectedVehicle }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Assignment failed')
      }
      toast.success('Delivery assigned')
      setShowAssign(false)
      startTransition(() => router.refresh())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (to: DeliveryStatus) => {
    if (to === 'FAILED' && !failureReason) {
      toast.error('Select a failure reason')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/${orgSlug}/deliveries/${delivery.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: to,
          ...(failureReason ? { failureReason, failureNote } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Status update failed')
      }
      toast.success(`Status updated to ${STATUS_LABELS[to]}`)
      setShowStatusModal(null)
      setFailureReason('')
      setFailureNote('')
      startTransition(() => router.refresh())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
      {/* Main column */}
      <div className="lg:col-span-2 space-y-6">
        {/* Status + actions */}
        <Card className="border-[#E2E8F0] shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_BADGE[delivery.status]}`}>
                  {STATUS_LABELS[delivery.status]}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_BADGE[delivery.priority]}`}>
                  {delivery.priority}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {canDispatch && delivery.status === 'PENDING_DISPATCH' && (
                  <Button
                    size="sm"
                    className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                    onClick={() => setShowAssign(true)}
                  >
                    <User className="h-3.5 w-3.5 mr-1.5" />
                    Assign Driver & Vehicle
                  </Button>
                )}
                {canDispatch && delivery.status === 'ASSIGNED' && (
                  <Button size="sm" variant="outline" onClick={() => setShowAssign(true)}>
                    Reassign
                  </Button>
                )}
                {availableTransitions
                  .filter(t => t !== 'ASSIGNED') // Assigned is handled by assign flow
                  .map(t => (
                    <Button
                      key={t}
                      size="sm"
                      variant={t === 'FAILED' || t === 'CANCELLED' ? 'destructive' : 'outline'}
                      onClick={() => setShowStatusModal(t)}
                    >
                      → {STATUS_LABELS[t]}
                    </Button>
                  ))
                }
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Addresses */}
        <Card className="border-[#E2E8F0] shadow-none">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#64748B]" />
              Addresses
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Pickup</p>
              <p className="text-sm text-[#0F172A]">{formatAddress(delivery.pickupAddress)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Delivery</p>
              <p className="text-sm text-[#0F172A]">{formatAddress(delivery.deliveryAddress)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Scheduling */}
        {(delivery.scheduledDate || delivery.timeWindowStart) && (
          <Card className="border-[#E2E8F0] shadow-none">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#64748B]" />
                Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {delivery.scheduledDate && (
                <div>
                  <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Date</p>
                  <p className="text-sm text-[#0F172A] mt-1">
                    {new Date(delivery.scheduledDate).toLocaleDateString('en-US', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </p>
                </div>
              )}
              {delivery.timeWindowStart && (
                <div>
                  <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Time Window</p>
                  <p className="text-sm text-[#0F172A] mt-1">
                    {new Date(delivery.timeWindowStart).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    {delivery.timeWindowEnd && ` – ${new Date(delivery.timeWindowEnd).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Proof of Delivery */}
        {delivery.proofOfDelivery && (
          <Card className="border-[#16A34A]/30 bg-green-50 shadow-none">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-[#16A34A]">
                <CheckCircle2 className="h-4 w-4" />
                Proof of Delivery
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Recipient</p>
                  <p className="text-sm text-[#0F172A] mt-1">{delivery.proofOfDelivery.recipientName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Delivered At</p>
                  <p className="text-sm text-[#0F172A] mt-1">
                    {new Date(delivery.proofOfDelivery.deliveredAt).toLocaleString()}
                  </p>
                </div>
              </div>
              {delivery.proofOfDelivery.driverNotes && (
                <div>
                  <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Notes</p>
                  <p className="text-sm text-[#0F172A] mt-1">{delivery.proofOfDelivery.driverNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Failure info */}
        {delivery.status === 'FAILED' && delivery.failureReason && (
          <Card className="border-red-200 bg-red-50 shadow-none">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-red-700">
                <AlertCircle className="h-4 w-4" />
                Failure Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm font-medium text-red-700">
                {delivery.failureReason.replace(/_/g, ' ')}
              </p>
              {delivery.failureNote && (
                <p className="text-sm text-red-600">{delivery.failureNote}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {delivery.notes && (
          <Card className="border-[#E2E8F0] shadow-none">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#64748B]" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#0F172A] whitespace-pre-wrap">{delivery.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Audit log */}
        {auditLogs.length > 0 && (
          <Card className="border-[#E2E8F0] shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3">
                    <div className="h-2 w-2 rounded-full bg-[#2563EB] mt-1.5 shrink-0" />
                    <div>
                      <p className="text-sm text-[#0F172A]">
                        <span className="font-medium">{log.action.replace(/\./g, ' → ')}</span>
                      </p>
                      <p className="text-xs text-[#64748B]">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Side column */}
      <div className="space-y-6">
        {/* Customer */}
        <Card className="border-[#E2E8F0] shadow-none">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-[#64748B]" />
              Customer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-semibold text-[#0F172A]">{delivery.customer.name}</p>
            {delivery.customer.email && (
              <p className="text-sm text-[#64748B]">{delivery.customer.email}</p>
            )}
            {delivery.customer.phone && (
              <p className="text-sm text-[#64748B]">{delivery.customer.phone}</p>
            )}
          </CardContent>
        </Card>

        {/* Assignment */}
        <Card className="border-[#E2E8F0] shadow-none">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="h-4 w-4 text-[#64748B]" />
              Assignment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider mb-1">Driver</p>
              {delivery.driver ? (
                <p className="text-sm text-[#0F172A] font-medium">{delivery.driver.name}</p>
              ) : (
                <p className="text-sm text-[#94a3b8] italic">Not assigned</p>
              )}
            </div>
            <Separator />
            <div>
              <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider mb-1">Vehicle</p>
              {delivery.vehicle ? (
                <div>
                  <p className="text-sm text-[#0F172A] font-medium">{delivery.vehicle.registrationNumber}</p>
                  <p className="text-xs text-[#64748B]">{delivery.vehicle.make} {delivery.vehicle.model}</p>
                </div>
              ) : (
                <p className="text-sm text-[#94a3b8] italic">Not assigned</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Meta */}
        <Card className="border-[#E2E8F0] shadow-none">
          <CardContent className="pt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#64748B]">Created</span>
              <span className="text-[#0F172A]">{new Date(delivery.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Updated</span>
              <span className="text-[#0F172A]">{new Date(delivery.updatedAt).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">ID</span>
              <span className="text-[#0F172A] font-mono text-xs">{delivery.id.slice(-12)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assign Modal */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {delivery.driverId ? 'Reassign' : 'Assign'} Driver & Vehicle
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Driver</Label>
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger><SelectValue placeholder="Select driver…" /></SelectTrigger>
                <SelectContent>
                  {drivers.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vehicle</Label>
              <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                <SelectTrigger><SelectValue placeholder="Select vehicle…" /></SelectTrigger>
                <SelectContent>
                  {vehicles.filter(v => v.status === 'AVAILABLE' || v.id === delivery.vehicleId).map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.registrationNumber} — {v.make} {v.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssign(false)}>Cancel</Button>
            <Button
              className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
              onClick={handleAssign}
              disabled={submitting || !selectedDriver || !selectedVehicle}
            >
              {submitting && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status change modal */}
      <Dialog open={!!showStatusModal} onOpenChange={() => setShowStatusModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Move to {showStatusModal ? STATUS_LABELS[showStatusModal] : ''}
            </DialogTitle>
          </DialogHeader>
          {showStatusModal === 'FAILED' && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Failure Reason *</Label>
                <Select value={failureReason} onValueChange={(v) => setFailureReason(v as FailureReason)}>
                  <SelectTrigger><SelectValue placeholder="Select reason…" /></SelectTrigger>
                  <SelectContent>
                    {FAILURE_REASONS.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  placeholder="Additional details…"
                  value={failureNote}
                  onChange={e => setFailureNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusModal(null)}>Cancel</Button>
            <Button
              variant={showStatusModal === 'FAILED' || showStatusModal === 'CANCELLED' ? 'destructive' : 'default'}
              className={showStatusModal !== 'FAILED' && showStatusModal !== 'CANCELLED' ? 'bg-[#2563EB] hover:bg-[#1d4ed8] text-white' : ''}
              onClick={() => showStatusModal && handleStatusChange(showStatusModal)}
              disabled={submitting}
            >
              {submitting && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
