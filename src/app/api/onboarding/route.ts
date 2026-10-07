import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse } from '@/lib/errors'
import { z } from 'zod'
import { hash } from 'bcryptjs'

const onboardingSchema = z.object({
  orgName: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  userName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = onboardingSchema.parse(body)

    const passwordHash = await hash(data.password, 12)

    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.userName,
          email: data.email,
          passwordHash,
        },
      })
      const org = await tx.organization.create({
        data: {
          name: data.orgName,
          slug: data.slug,
        },
      })
      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: 'OWNER',
        },
      })
      return { userId: user.id, orgSlug: org.slug }
    })

    return Response.json(result, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
