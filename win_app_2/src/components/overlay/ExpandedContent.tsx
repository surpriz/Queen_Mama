import { useState, useEffect, useCallback } from 'react'
import { Camera, Monitor } from 'lucide-react'
import { TabBar } from './TabBar'
import { TranscriptPanel } from './TranscriptPanel'
import { ResponseDisplay } from './ResponseDisplay'
import { InputBar } from './InputBar'
import { useConfigStore } from '@/stores/configStore'
import { useAppStore } from '@/stores/appStore'
import { useAiResponse } from '@/hooks/useAiResponse'
import { screenCaptureService } from '@/services/screenCapture/screenCaptureService'
import { ResponseType } from '@/types/models'

export function ExpandedContent() {
  const autoScreenCapture = useConfigStore((s) => s.autoScreenCapture)
  const updateConfig = useConfigStore((s) => s.updateConfig)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const isSessionActive = useAppStore((s) => s.isSessionActive)
  const currentTranscript = useAppStore((s) => s.currentTranscript)
  const { triggerByType, isProcessing } = useAiResponse()

  // Periodically fetch the cached screenshot for preview
  useEffect(() => {
    if (!autoScreenCapture) {
      setScreenshotPreview(null)
      return
    }

    let mounted = true

    const fetchPreview = async () => {
      try {
        const cached = await screenCaptureService.getCachedOrCapture()
        if (mounted && cached) {
          setScreenshotPreview(cached)
        }
      } catch {
        // Silently fail - preview is optional
      }
    }

    // Fetch immediately, then every 5 seconds
    fetchPreview()
    const interval = setInterval(fetchPreview, 5000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [autoScreenCapture])

  const handleToggleScreenCapture = useCallback(() => {
    updateConfig({ autoScreenCapture: !autoScreenCapture })
  }, [autoScreenCapture, updateConfig])

  const handleTabSelected = useCallback(
    (type: ResponseType) => {
      if (isSessionActive && currentTranscript.trim().length > 0 && !isProcessing) {
        triggerByType(type)
      }
    },
    [isSessionActive, currentTranscript, isProcessing, triggerByType],
  )

  return (
    <div className="flex flex-col flex-1 min-h-0 border-t border-white/5 overflow-hidden">
      <TranscriptPanel />

      {/* Screenshot preview thumbnail */}
      {autoScreenCapture && screenshotPreview && (
        <div className="px-3 pt-1.5 pb-1">
          <button
            onClick={handleToggleScreenCapture}
            className="group relative rounded-qm-md overflow-hidden border border-white/10 hover:border-qm-accent/40 transition-colors"
            title="Click to toggle screen capture"
          >
            <img
              src={screenshotPreview}
              alt="Screen capture"
              className="block max-w-[120px] h-auto rounded-qm-md opacity-70 group-hover:opacity-100 transition-opacity"
            />
            <div className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5">
              <Camera size={10} className="text-qm-accent" />
            </div>
          </button>
        </div>
      )}

      <ResponseDisplay />

      <TabBar onTabSelected={handleTabSelected} />

      {/* "Screen only" badge when session is not active */}
      {!isSessionActive && (
        <div className="px-3 py-1">
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10">
            <Monitor size={10} className="text-yellow-400" />
            <span className="text-caption-sm font-medium text-yellow-400">Screen only</span>
          </div>
        </div>
      )}

      <InputBar />
    </div>
  )
}
