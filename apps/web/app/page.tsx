import { connection } from 'next/server'
import { HeraldApp } from '@/components/HeraldApp'
import { doorLabel, simulatorEnabled } from '@/lib/server/config'

export default async function Page() {
  // Read configuration per request, not at build time.
  await connection()
  return <HeraldApp door={doorLabel()} simulator={simulatorEnabled()} />
}
