import { useAppStore } from '@/stores/appStore'

export function AudioLevelIndicator() {
  const audioLevel = useAppStore((s) => s.audioLevel)
  const isSessionActive = useAppStore((s) => s.isSessionActive)

  if (!isSessionActive) return null

  // Distribute level across 4 bars with slight variation for visual interest
  const barHeights = [
    Math.min(audioLevel * 1.2, 1),
    Math.min(audioLevel * 0.9, 1),
    Math.min(audioLevel * 1.1, 1),
    Math.min(audioLevel * 0.8, 1),
  ]

  return (
    <div className="flex items-end gap-0.5 h-4">
      {barHeights.map((height, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-gradient-to-t from-qm-gradient-start to-qm-gradient-end transition-all duration-150 ease-out"
          style={{
            height: `${Math.max(height * 100, 25)}%`,
            opacity: Math.max(height, 0.4),
          }}
        />
      ))}
    </div>
  )
}
