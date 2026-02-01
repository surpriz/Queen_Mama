import { Camera } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

interface ScreenshotIndicatorProps {
  timestamp: string
  className?: string
}

export function ScreenshotIndicator({ timestamp, className }: ScreenshotIndicatorProps) {
  const [showFlash, setShowFlash] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShowFlash(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-full bg-qm-success/15 border border-qm-success/30 ${className}`}
      title={`Screenshot captured at ${formattedTime}`}
    >
      <div className="relative">
        <Camera size={11} className="text-qm-success" />
        {showFlash && (
          <span className="absolute inset-0 rounded-full bg-qm-success animate-ping opacity-75" />
        )}
      </div>
      <span className="text-[10px] font-medium text-qm-success">Screen captured</span>
    </motion.div>
  )
}
