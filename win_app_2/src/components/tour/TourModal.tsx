import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/common/Modal'
import { TourStep } from '@/components/onboarding/TourStep'
import { useTourStore } from '@/stores/tourStore'

/**
 * In-app feature tour (mac `FeatureTourSheet`): the same screens as the
 * onboarding tour, reachable from the sidebar at any time.
 */
export function TourModal() {
  const { t } = useTranslation()
  const isOpen = useTourStore((s) => s.isTourOpen)
  const close = useTourStore((s) => s.closeTour)

  return (
    <Modal isOpen={isOpen} onClose={close} size="xl" showCloseButton>
      <div className="h-[70vh] min-h-[480px]">
        <TourStep onContinue={close} onBack={close} finishLabel={t('close')} />
      </div>
    </Modal>
  )
}
