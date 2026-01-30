import { OverlayContent } from './OverlayContent'

export function OverlayApp() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-transparent">
      <OverlayContent />
    </div>
  )
}
