import { useCallback } from 'react'
import { useOverlayStore } from '@/stores/overlayStore'
import type { OverlayPosition } from '@/types/electron.d'

export function useOverlay() {
  const isExpanded = useOverlayStore((s) => s.isExpanded)
  const position = useOverlayStore((s) => s.position)
  const setExpanded = useOverlayStore((s) => s.setExpanded)
  const setPosition = useOverlayStore((s) => s.setPosition)

  const toggle = useCallback(() => {
    setExpanded(!isExpanded)
  }, [isExpanded, setExpanded])

  const expand = useCallback(() => {
    setExpanded(true)
  }, [setExpanded])

  const collapse = useCallback(() => {
    setExpanded(false)
  }, [setExpanded])

  const moveTo = useCallback(
    (pos: OverlayPosition) => {
      setPosition(pos)
    },
    [setPosition],
  )

  const show = useCallback(() => {
    window.electronAPI?.overlay.show()
  }, [])

  const hide = useCallback(() => {
    window.electronAPI?.overlay.hide()
  }, [])

  return {
    isExpanded,
    position,
    toggle,
    expand,
    collapse,
    moveTo,
    show,
    hide,
  }
}
