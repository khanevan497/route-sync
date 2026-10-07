'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  MapPin, Phone, CheckCircle2, AlertCircle, Clock, Truck,
  ChevronRight, RefreshCw, User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { Driver, Delivery, Customer, Vehicle, FailureReason } from '@prisma/client'

type DeliveryWithRelations = Delivery & {
  customer: Pick<Customer, 'id' | 'name' | 'phone'>
  vehicle: Pick<Vehicle, 'id' | 'registrationNumber' | 'make' | 'model'> | null
}

interface Props {
  driver: Driver
  deliveries: DeliveryWithRelations[]
  orgSlug: string
}

const STATUS_COLORS: Record<string, string> = {
  ASSIGNED: 'bg-blue-500',
  IN_TRANSIT: 'bg-purple-500',
  DELIVERED: 'bg-green-500',
  FAILED: 'bg-red-500',
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
  if (!addr || typeof addr !== 'object') return ''
  const a = addr as Record<string, string>
  return [a.street, a.city].filter(Boolean).join(', ')
}

export function DriverTodayView({ driver, deliveries, orgSlug }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [activeDelivery, setActiveDelivery] = useState<DeliveryWithRelations | null>(null)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [showFailModal, setShowFailModal] = useState(false)
  const [recipientName, setRecipientName] = useState('')
  const [driverNotes, setDriverNotes] = useState('')
  const [failureReason, setFailureReason] = useState<FailureReason | ''>('')
  const [failureNote, setFailureNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const changeStatus = async (deliveryId: string, status: string, extra?: Record<string, string>) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/${orgSlug}/deliveries/${deliveryId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extra }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Update failed')
      }
      toast.success(status === 'IN_TRANSIT' ? 'Route started!' : status === 'DELIVERED' ? 'Delivery completed!' : 'Updated')
      startTransition(() => router.refresh())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSubmitting(false)
    }
  }

  const submitProof = async (deliveryId: string) => {
    if (!recipientName.trim()) {
      toast.error('Enter recipient name')
      return
    }
    setSubmitting(true)
    try {
      // First submit proof
      const proofRes = await fetch(`/api/${orgSlug}/deliveries/${deliveryId}/proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: recipientName.trim(),
          deliveredAt: new Date().toISOString(),
          driverNotes: driverNotes || undefined,
        }),
      })
      if (!proofRes.ok) {
        const data = await proofRes.json()
        throw new Error(data.error ?? 'Failed to submit proof')
      }
      toast.success('Delivery completed!')
      setShowCompleteModal(false)
      setRecipientName('')
      setDriverNotes('')
      setActiveDelivery(null)
      startTransition(() => router.refresh())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  const submitFailure = async (deliveryId: string) => {
    if (!failureReason) {
      toast.error('Select a failure reason')
      return
    }
    setSubmitting(true)
    try {
      await changeStatus(deliveryId, 'FAILED', {
        failureReason,
        ...(failureNote ? { failureNote } : {}),
      })
      setShowFailModal(false)
      setFailureReason('')
      setFailureNote('')
      setActiveDelivery(null)
    } finally {
      setSubmitting(false)
    }
  }

  if (deliveries.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <CheckCircle2 className="h-16 w-16 text-[#16A34A] mb-4 opacity-60" />
        <h2 className="text-xl font-bold text-[#0F172A]">All clear!</h2>
        <p className="text-[#64748B] mt-2 text-sm">No deliveries scheduled for today.</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Driver info */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-[#2563EB] flex items-center justify-center text-white font-bold text-lg">
          {driver.name.charAt(0)}
        </div>
        <div>
          <p className="font-semibold text-[#0F172A]">{driver.name}</p>
          <p className="text-xs text-[#64748B]">License: {driver.licenseNumber}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-2xl font-bold text-[#0F172A]">{deliveries.length}</p>
          <p className="text-xs text-[#64748B]">stops today</p>
        </div>
      </div>

      {/* Delivery list */}
      <div className="space-y-3">
        {deliveries.map((d, index) => (
          <Card key={d.id} className="border-[#E2E8F0] shadow-none overflow-hidden">
            <CardContent className="p-0">
              {/* Status bar */}
              <div className={`h-1 ${STATUS_COLORS[d.status] ?? 'bg-gray-300'}`} />
              <div className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded">
                        #{index + 1}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        d.status === 'IN_TRANSIT' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {d.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="font-semibold text-[#0F172A] mt-1">{d.customer.name}</p>
                  </div>
                  {d.priority !== 'NORMAL' && (
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      d.priority === 'URGENT' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {d.priority}
                    </span>
                  )}
                </div>

                {/* Address */}
                <div className="flex items-start gap-2 text-sm text-[#64748B]">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-[#2563EB]" />
                  <span>{formatAddress(d.deliveryAddress)}</span>
                </div>

                {/* Phone */}
                {d.customer.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-[#64748B]" />
                    <a href={`tel:${d.customer.phone}`} className="text-[#2563EB] font-medium">
                      {d.customer.phone}
                    </a>
                  </div>
                )}

                {/* Time window */}
                {d.timeWindowStart && (
                  <div className="flex items-center gap-2 text-sm text-[#64748B]">
                    <Clock className="h-4 w-4" />
                    <span>
                      {new Date(d.timeWindowStart).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      {d.timeWindowEnd && ` – ${new Date(d.timeWindowEnd).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                    </span>
                  </div>
                )}

                {/* Notes */}
                {d.notes && (
                  <p className="text-xs text-[#64748B] bg-[#F8FAFC] rounded p-2">{d.notes}</p>
                )}

                {/* Vehicle */}
                {d.vehicle && (
                  <div className="flex items-center gap-2 text-xs text-[#94a3b8]">
                    <Truck className="h-3.5 w-3.5" />
                    {d.vehicle.registrationNumber} · {d.vehicle.make} {d.vehicle.model}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  {d.status === 'ASSIGNED' && (
                    <Button
                      className="flex-1 bg-[#2563EB] hover:bg-[#1d4ed8] text-white h-11"
                      disabled={submitting}
                      onClick={() => changeStatus(d.id, 'IN_TRANSIT')}
                    >
                      {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Start Route'}
                    </Button>
                  )}
                  {d.status === 'IN_TRANSIT' && (
                    <>
                      <Button
                        className="flex-1 bg-[#16A34A] hover:bg-green-700 text-white h-11"
                        onClick={() => { setActiveDelivery(d); setShowCompleteModal(true) }}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1.5" />
                        Delivered
                      </Button>
                      <Button
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50 h-11 px-3"
                        onClick={() => { setActiveDelivery(d); setShowFailModal(true) }}
                      >
                        <AlertCircle className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Complete delivery modal */}
      <Dialog open={showCompleteModal} onOpenChange={setShowCompleteModal}>
        <DialogContent className="sm:max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle>Confirm Delivery</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Recipient Name *</Label>
              <Input
                placeholder="Who received the package?"
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Left at door, gave to neighbour, etc."
                value={driverNotes}
                onChange={e => setDriverNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteModal(false)}>Cancel</Button>
            <Button
              className="bg-[#16A34A] hover:bg-green-700 text-white"
              onClick={() => activeDelivery && submitProof(activeDelivery.id)}
              disabled={submitting || !recipientName.trim()}
            >
              {submitting && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Failure modal */}
      <Dialog open={showFailModal} onOpenChange={setShowFailModal}>
        <DialogContent className="sm:max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle>Report Failure</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Reason *</Label>
              <Select value={failureReason} onValueChange={(v) => setFailureReason(v as FailureReason)}>
                <SelectTrigger><SelectValue placeholder="Select reason…" /></SelectTrigger>
                <SelectContent>
                  {FAILURE_REASONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Additional details…"
                value={failureNote}
                onChange={e => setFailureNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFailModal(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => activeDelivery && submitFailure(activeDelivery.id)}
              disabled={submitting || !failureReason}
            >
              {submitting && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Report Failure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
