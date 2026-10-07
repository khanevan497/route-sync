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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

interface FormData {
  registrationNumber: string
  make: string
  model: string
  year: string
  type: string
  mileage: string
}

const schema = z.object({
  registrationNumber: z.string().min(1, 'Registration is required'),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  year: z.string().min(4),
  type: z.string().min(1),
  mileage: z.string(),
})

export function CreateVehicleDialog({ orgSlug }: { orgSlug: string }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()
  const [vehicleType, setVehicleType] = useState<string>('VAN')

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'VAN', mileage: '0', year: String(new Date().getFullYear()) },
  })

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/${orgSlug}/vehicles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          year: parseInt(data.year),
          mileage: parseInt(data.mileage) || 0,
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Failed to create vehicle')
      }
      toast.success('Vehicle added')
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
        Add Vehicle
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Vehicle</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Registration Number *</Label>
                <Input {...register('registrationNumber')} placeholder="ABC-1234" className={errors.registrationNumber ? 'border-red-400' : ''} />
                {errors.registrationNumber && <p className="text-xs text-red-500">{errors.registrationNumber.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Make *</Label>
                <Input {...register('make')} placeholder="Ford" />
                {errors.make && <p className="text-xs text-red-500">{errors.make.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Model *</Label>
                <Input {...register('model')} placeholder="Transit" />
                {errors.model && <p className="text-xs text-red-500">{errors.model.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Year *</Label>
                <Input type="number" {...register('year')} placeholder="2023" />
                {errors.year && <p className="text-xs text-red-500">{errors.year.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Mileage</Label>
                <Input type="number" {...register('mileage')} placeholder="0" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Type *</Label>
                <Select value={vehicleType} onValueChange={(v) => { setVehicleType(v); setValue('type', v as any) }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VAN">Van</SelectItem>
                    <SelectItem value="TRUCK">Truck</SelectItem>
                    <SelectItem value="CAR">Car</SelectItem>
                    <SelectItem value="MOTORCYCLE">Motorcycle</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white" disabled={submitting}>
                {submitting && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                Add Vehicle
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
