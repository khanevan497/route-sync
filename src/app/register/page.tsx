'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Navigation2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

const registerSchema = z.object({
  orgName: z.string().min(2, 'Organization name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers and hyphens'),
  userName: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const orgName = watch('orgName')

  const handleOrgNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setValue('orgName', value)
    // Auto-generate slug from org name
    const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    setValue('slug', slug)
  }

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Failed to create account')
        return
      }

      const { orgSlug } = await res.json()

      // Sign in automatically
      const signInResult = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (signInResult?.error) {
        toast.error('Account created but sign-in failed. Please log in manually.')
        router.push('/login')
        return
      }

      toast.success('Organization created! Welcome to RouteSync.')
      router.push(`/${orgSlug}`)
      router.refresh()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="bg-[#0D9488] rounded-lg p-2">
              <Navigation2 className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-[#0F172A]">RouteSync</span>
          </div>
        </div>

        <Card className="border-[#E2E8F0] shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-semibold">Create your account</CardTitle>
            <CardDescription className="text-[#64748B]">
              Create your workspace and start coordinating your operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  placeholder="Acme Logistics"
                  {...register('orgName')}
                  onChange={handleOrgNameChange}
                  className={errors.orgName ? 'border-[#DC2626]' : ''}
                />
                {errors.orgName && (
                  <p className="text-sm text-[#DC2626]">{errors.orgName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Organization Slug</Label>
                <div className="flex items-center">
                  <span className="text-sm text-[#64748B] mr-1">routesync.app/</span>
                  <Input
                    id="slug"
                    placeholder="acme-logistics"
                    {...register('slug')}
                    className={`flex-1 ${errors.slug ? 'border-[#DC2626]' : ''}`}
                  />
                </div>
                {errors.slug && (
                  <p className="text-sm text-[#DC2626]">{errors.slug.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="userName">Your Name</Label>
                <Input
                  id="userName"
                  placeholder="Jane Smith"
                  {...register('userName')}
                  className={errors.userName ? 'border-[#DC2626]' : ''}
                />
                {errors.userName && (
                  <p className="text-sm text-[#DC2626]">{errors.userName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="jane@acme.com"
                  {...register('email')}
                  className={errors.email ? 'border-[#DC2626]' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-[#DC2626]">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 8 characters"
                  {...register('password')}
                  className={errors.password ? 'border-[#DC2626]' : ''}
                />
                {errors.password && (
                  <p className="text-sm text-[#DC2626]">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-[#0D9488] hover:bg-[#0F766E] text-white"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create account'
                )}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-[#64748B]">
              Already have an account?{' '}
              <Link href="/login" className="text-[#0D9488] hover:underline font-medium">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
