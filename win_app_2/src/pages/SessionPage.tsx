import { useEffect } from 'react'
import { registerSessionHost } from '@/services/session/sessionHost'

/**
 * Rendered only in the hidden session window. No UI: it exists to run the
 * session pipeline and answer commands from the visible windows.
 */
export function SessionPage() {
  useEffect(() => registerSessionHost(), [])

  return (
    <div className="p-2 text-xs text-qm-text-tertiary select-none">
      Queen Mama session host
    </div>
  )
}
