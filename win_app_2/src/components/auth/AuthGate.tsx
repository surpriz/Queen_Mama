import { useAuthStore } from '@/stores/authStore'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { GradientText } from '@/components/common/GradientText'

interface AuthGateProps {
  children: React.ReactNode
}

/**
 * Renders children once the relayed auth state says we are signed in.
 * The credential check itself runs once, in the hidden session window.
 */
export function AuthGate({ children }: AuthGateProps) {
  const authState = useAuthStore((s) => s.authState)

  if (authState.type === 'unknown') {
    return (
      <div className="flex h-screen items-center justify-center bg-qm-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <GradientText as="h1" className="text-title-lg font-bold">
            Queen Mama
          </GradientText>
          <LoadingSpinner size={24} />
          <p className="text-body-sm text-qm-text-secondary">Loading...</p>
        </div>
      </div>
    )
  }

  if (authState.type === 'authenticated') {
    return <>{children}</>
  }

  return null
}
