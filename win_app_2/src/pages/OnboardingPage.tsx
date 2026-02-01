import { useNavigate } from 'react-router-dom'
import { OnboardingView } from '@/components/onboarding'

export function OnboardingPage() {
  const navigate = useNavigate()

  const handleOnboardingComplete = () => {
    navigate('/')
  }

  return <OnboardingView onComplete={handleOnboardingComplete} />
}
