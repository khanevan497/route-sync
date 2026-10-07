'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { Customer } from '@prisma/client'

const schema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  pickupStreet: z.string().min(1, 'Pickup street is required'),
  pickupCity: z.string().min(1, 'Pickup city is required'),
  deliveryStreet: z.string().min(1, 'Delivery street is required'),
  deliveryCity: z.string().min(1, 'Delivery city is required'),
  scheduledDate: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  orgSlug: string
  customers: Pick<Customer, 'id' | 'name'>[]
}

export function CreateDeliveryDialog({ orgSlug, customers }: Props) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'NORMAL' as const },
  })

  const priority = watch('priority')
  const customerId = watch('customerId')

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/${orgSlug}/deliveries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: data.customerId,
          pickupAddress: { street: data.pickupStreet, city: data.pickupCity },
          deliveryAddress: { street: data.deliveryStreet, city: data.deliveryCity },
          scheduledDate: data.scheduledDate ? new Date(data.scheduledDate).toISOString() : undefined,
          priority: data.priority,
          notes: data.notes || undefined,
        }),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Failed to create delivery')
      }

      toast.success('Delivery created')
      reset()
      setOpen(false)
      startTransition(() => router.refresh())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4 mr-1.5" />
        New Delivery
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Delivery Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Customer */}
            <div className="space-y-1.5">
              <Label>Customer *</Label>
              <Select value={customerId} onValueChange={(v) => setValue('customerId', v)}>
                <SelectTrigger className={errors.customerId ? 'border-[#DC2626]' : ''}>
                  <SelectValue placeholder="Select customer…" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.customerId && <p className="text-xs text-[#DC2626]">{errors.customerId.message}</p>}
            </div>

            {/* Pickup address */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Pickup Address</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Input
                    placeholder="Street"
                    {...register('pickupStreet')}
                    className={errors.pickupStreet ? 'border-[#DC2626]' : ''}
                  />
                  {errors.pickupStreet && <p className="text-xs text-[#DC2626]">{errors.pickupStreet.message}</p>}
                </div>
                <div className="space-y-1">
                  <Input
                    placeholder="City"
                    {...register('pickupCity')}
                    className={errors.pickupCity ? 'border-[#DC2626]' : ''}
                  />
                </div>
              </div>
            </div>

            {/* Delivery address */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Delivery Address</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Input
                    placeholder="Street"
                    {...register('deliveryStreet')}
                    className={errors.deliveryStreet ? 'border-[#DC2626]' : ''}
                  />
                  {errors.deliveryStreet && <p className="text-xs text-[#DC2626]">{errors.deliveryStreet.message}</p>}
                </div>
                <div className="space-y-1">
                  <Input
                    placeholder="City"
                    {...register('deliveryCity')}
                    className={errors.deliveryCity ? 'border-[#DC2626]' : ''}
                  />
                </div>
              </div>
            </div>

            {/* Schedule + Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Scheduled Date</Label>
                <Input type="date" {...register('scheduledDate')} />
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setValue('priority', v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Special instructions, access codes, etc."
                rows={3}
                {...register('notes')}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                disabled={submitting}
              >
                {submitting && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                Create Delivery
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
