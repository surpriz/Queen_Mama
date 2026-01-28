import { useCallback } from 'react'
import { useOverlayStore, type OverlayPosition } from '@/stores/overlayStore'

export function useOverlay() {
  const isExpanded = useOverlayStore((s) => s.isExpanded)
  const position = useOverlayStore((s) => s.position)
  const setExpanded = useOverlayStore((s) => s.setExpanded)
  const setPosition = useOverlayStore((s) => s.setPosition)

  const toggle = useCallback(() => {
    const newExpanded = !isExpanded
    setExpanded(newExpanded)
    window.electronAPI?.overlay.setExpanded(newExpanded)
  }, [isExpanded, setExpanded])

  const expand = useCallback(() => {
    setExpanded(true)
    window.electronAPI?.overlay.setExpanded(true)
  }, [setExpanded])

  const collapse = useCallback(() => {
    setExpanded(false)
    window.electronAPI?.overlay.setExpanded(false)
  }, [setExpanded])

  const moveTo = useCallback(
    (pos: OverlayPosition) => {
      setPosition(pos)
      window.electronAPI?.overlay.setPosition(pos)
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
