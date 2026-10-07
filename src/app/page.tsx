import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  // Find the user's first organization membership
  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!membership) {
    redirect('/register')
  }

  redirect(`/${membership.organization.slug}`)
}
