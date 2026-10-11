import { useEffect } from 'react'
import { OverlayApp } from '@/components/overlay/OverlayApp'
import { useOverlayStore } from '@/stores/overlayStore'
import * as relay from '@/services/relay/relayClient'
import type { ResponseType } from '@/types/models'

export function OverlayPage() {
  // Host-driven UI commands (proactive answers expand the widget / switch tab)
  useEffect(() => {
    return relay.on('relay:overlay', (data) => {
      const store = useOverlayStore.getState()
      if (data.selectTab) store.setSelectedTab(data.selectTab as ResponseType)
      if (data.expand && !store.isExpanded) store.setExpanded(true)
    })
  }, [])

  useEffect(() => {
    document.body.style.background = 'transparent'
    document.documentElement.style.background = 'transparent'
    document.documentElement.classList.add('qm-overlay-window')

    return () => {
      document.body.style.background = ''
      document.documentElement.style.background = ''
      document.documentElement.classList.remove('qm-overlay-window')
    }
  }, [])

  return <OverlayApp />
}
