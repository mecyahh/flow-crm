// FILE: /app/follow-ups/page.tsx
// ACTION: REPLACE ENTIRE FILE WITH THIS

export const dynamic = 'force-dynamic'
export const revalidate = 0

import FollowUpsClient from './ui'

export default function FollowUpsPage() {
  return <FollowUpsClient />
}
