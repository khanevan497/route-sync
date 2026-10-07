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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  licenseNumber: z.string().min(1, 'License number is required'),
  licenseExpiry: z.string().min(1, 'License expiry is required'),
})

type FormData = z.infer<typeof schema>

export function CreateDriverDialog({ orgSlug }: { orgSlug: string }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/${orgSlug}/drivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          licenseExpiry: new Date(data.licenseExpiry).toISOString(),
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Failed to create driver')
      }
      toast.success('Driver created')
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
      <Button className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1.5" />
        Add Driver
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Driver</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Full Name *</Label>
                <Input {...register('name')} placeholder="John Smith" className={errors.name ? 'border-red-400' : ''} />
                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" {...register('email')} placeholder="john@company.com" className={errors.email ? 'border-red-400' : ''} />
                {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input {...register('phone')} placeholder="+1 555 0100" />
              </div>
              <div className="space-y-1.5">
                <Label>License Number *</Label>
                <Input {...register('licenseNumber')} placeholder="DL123456" className={errors.licenseNumber ? 'border-red-400' : ''} />
                {errors.licenseNumber && <p className="text-xs text-red-500">{errors.licenseNumber.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>License Expiry *</Label>
                <Input type="date" {...register('licenseExpiry')} className={errors.licenseExpiry ? 'border-red-400' : ''} />
                {errors.licenseExpiry && <p className="text-xs text-red-500">{errors.licenseExpiry.message}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white" disabled={submitting}>
                {submitting && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                Create Driver
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
