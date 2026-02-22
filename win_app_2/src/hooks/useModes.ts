/**
 * React hook for loading and managing modes from SQLite
 */

import { useState, useEffect, useCallback } from 'react'
import type { Mode } from '@/types/models'
import { BUILT_IN_MODE_NAMES } from '@/types/models'
import { modesService } from '@/services/modes/modesService'

export function useModes() {
  const [modes, setModes] = useState<Mode[]>([])
  const [loading, setLoading] = useState(true)

  const loadModes = useCallback(async () => {
    try {
      const allModes = await modesService.getAll()
      setModes(allModes)
    } catch (err) {
      console.error('[useModes] Failed to load modes:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadModes()
  }, [loadModes])

  const builtInModes = modes.filter((m) =>
    BUILT_IN_MODE_NAMES.includes(m.name as (typeof BUILT_IN_MODE_NAMES)[number])
  )
  const customModes = modes.filter(
    (m) => !BUILT_IN_MODE_NAMES.includes(m.name as (typeof BUILT_IN_MODE_NAMES)[number])
  )

  const saveMode = useCallback(
    async (mode: Mode) => {
      const existing = modes.find((m) => m.id === mode.id)
      if (existing) {
        await modesService.update(mode)
      } else {
        await modesService.create(mode)
      }
      await loadModes()
    },
    [modes, loadModes]
  )

  const deleteMode = useCallback(
    async (id: string) => {
      await modesService.remove(id)
      await loadModes()
    },
    [loadModes]
  )

  return {
    modes,
    builtInModes,
    customModes,
    loading,
    saveMode,
    deleteMode,
    reload: loadModes,
  }
}
