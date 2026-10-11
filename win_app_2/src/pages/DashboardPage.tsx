import { AuthGate } from '@/components/auth/AuthGate'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'

export function DashboardPage() {
  return (
    <AuthGate>
      <DashboardLayout />
    </AuthGate>
  )
}
