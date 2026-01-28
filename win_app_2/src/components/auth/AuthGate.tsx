import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { GradientText } from '@/components/common/GradientText'

interface AuthGateProps {
  children: React.ReactNode
  onNeedAuth: () => void
}

export function AuthGate({ children, onNeedAuth }: AuthGateProps) {
  const { authState, checkExistingAuth } = useAuth()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    async function check() {
      await checkExistingAuth()
      setIsChecking(false)
    }
    check()
  }, [])

  useEffect(() => {
    if (!isChecking && authState.type === 'unauthenticated') {
      onNeedAuth()
    }
  }, [isChecking, authState.type, onNeedAuth])

  if (isChecking || authState.type === 'unknown') {
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
