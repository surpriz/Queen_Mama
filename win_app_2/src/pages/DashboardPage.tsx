import { AuthGate } from '@/components/auth/AuthGate'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { useTranscriptSync } from '@/hooks/useTranscriptSync'

export function DashboardPage() {
  useTranscriptSync()

  return (
    <AuthGate>
      <DashboardLayout />
    </AuthGate>
  )
}
