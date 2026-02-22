import { createLogger } from '@/lib/logger'

const log = createLogger('ScreenCapture')

type ScreenCaptureCallback = (imageData: string) => void

interface ScreenAnalysis {
  entropy: number       // 0-1: how much visual information
  hasUsefulContent: boolean
  skipReason?: string
}

let captureInterval: ReturnType<typeof setInterval> | null = null
let isCapturing = false
let lastHash: string | null = null
let onCaptureCallback: ScreenCaptureCallback | null = null

// Pre-capture cache for instant access during AI triggers
let cachedScreenshotData: string | null = null
let cachedScreenshotTimestamp = 0
const CACHE_MAX_AGE = 30000 // 30 seconds - generous for AI triggers on static screens

async function hashImage(dataUrl: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(dataUrl)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Analyze screenshot content to determine if it's worth sending to AI.
 * Skips empty/uniform screens (desktop wallpaper, blank screens).
 */
function analyzeScreenContent(canvas: HTMLCanvasElement): ScreenAnalysis {
  const ctx = canvas.getContext('2d')
  if (!ctx) return { entropy: 0, hasUsefulContent: false, skipReason: 'No canvas context' }

  // Sample pixels for entropy calculation (every 10th pixel for performance)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = imageData.data
  const step = 40 // sample every 10th pixel (4 channels per pixel)
  const colorBuckets = new Map<string, number>()
  let totalSamples = 0

  for (let i = 0; i < pixels.length; i += step) {
    // Quantize to 32 levels per channel for grouping
    const r = Math.floor(pixels[i] / 8)
    const g = Math.floor(pixels[i + 1] / 8)
    const b = Math.floor(pixels[i + 2] / 8)
    const key = `${r},${g},${b}`
    colorBuckets.set(key, (colorBuckets.get(key) || 0) + 1)
    totalSamples++
  }

  // Calculate Shannon entropy
  let entropy = 0
  for (const count of colorBuckets.values()) {
    const p = count / totalSamples
    if (p > 0) entropy -= p * Math.log2(p)
  }

  // Normalize entropy to 0-1 (max theoretical ~15 bits for 32^3 buckets)
  const normalizedEntropy = Math.min(1, entropy / 10)

  // Check if dominant color takes too much space (uniform screen)
  const maxBucket = Math.max(...colorBuckets.values())
  const dominantRatio = maxBucket / totalSamples

  if (normalizedEntropy < 0.15) {
    return { entropy: normalizedEntropy, hasUsefulContent: false, skipReason: 'Empty screen (low entropy)' }
  }

  if (dominantRatio > 0.85) {
    return { entropy: normalizedEntropy, hasUsefulContent: false, skipReason: 'Uniform screen (single dominant color)' }
  }

  return { entropy: normalizedEntropy, hasUsefulContent: true }
}

async function captureAndProcess(): Promise<string | null> {
  try {
    // Request screen capture via IPC to main process
    const dataUrl = await window.electronAPI?.screen.capture()
    if (!dataUrl) {
      log.warn('screen.capture() returned null')
      return null
    }

    // Deduplicate using hash - only skip for auto-capture callbacks,
    // still update cache so getCachedOrCapture can return it
    const hash = await hashImage(dataUrl)
    if (hash === lastHash) {
      // Screen unchanged - refresh cache timestamp but don't reprocess
      if (cachedScreenshotData) {
        cachedScreenshotTimestamp = Date.now()
      }
      return null
    }
    lastHash = hash

    // Resize to max 1024x576 and compress as JPEG 50%
    const resized = await resizeAndAnalyze(dataUrl, 1024, 576, 0.5)
    return resized
  } catch (error) {
    log.error('Capture failed:', error)
    return null
  }
}

function resizeAndAnalyze(
  dataUrl: string,
  maxWidth: number,
  maxHeight: number,
  quality: number,
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      const ratio = Math.min(maxWidth / width, maxHeight / height, 1)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)

      // Smart content analysis - skip empty/uniform screens
      const analysis = analyzeScreenContent(canvas)
      if (!analysis.hasUsefulContent) {
        log.info(`Skipping screenshot: ${analysis.skipReason} (entropy: ${analysis.entropy.toFixed(3)})`)
        resolve(null)
        return
      }

      const result = canvas.toDataURL('image/jpeg', quality)

      // Update pre-capture cache
      cachedScreenshotData = result
      cachedScreenshotTimestamp = Date.now()

      resolve(result)
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

export const screenCaptureService = {
  isCapturing(): boolean {
    return isCapturing
  },

  onCapture(callback: ScreenCaptureCallback): void {
    onCaptureCallback = callback
  },

  /**
   * Get cached screenshot if available, otherwise capture new one.
   * Falls back to cached data when fresh capture returns null (hash dedup on static screens).
   */
  async getCachedOrCapture(): Promise<string | null> {
    const age = Date.now() - cachedScreenshotTimestamp
    if (cachedScreenshotData && age < CACHE_MAX_AGE) {
      log.info(`Using cached screenshot (age: ${age}ms)`)
      return cachedScreenshotData
    }

    // Try fresh capture
    const fresh = await captureAndProcess()
    if (fresh) return fresh

    // Fallback: return cached data even if stale (better than nothing for AI context)
    if (cachedScreenshotData) {
      log.info(`Fresh capture returned null, using stale cached screenshot (age: ${age}ms)`)
      return cachedScreenshotData
    }

    log.warn('No screenshot available (no cache, no fresh capture)')
    return null
  },

  async captureOnce(): Promise<string | null> {
    return captureAndProcess()
  },

  startAutoCapture(intervalMs: number = 30000): void {
    if (isCapturing) return
    isCapturing = true
    lastHash = null

    captureInterval = setInterval(async () => {
      const image = await captureAndProcess()
      if (image && onCaptureCallback) {
        onCaptureCallback(image)
      }
    }, intervalMs)
  },

  stopAutoCapture(): void {
    isCapturing = false
    if (captureInterval) {
      clearInterval(captureInterval)
      captureInterval = null
    }
    lastHash = null
    cachedScreenshotData = null
  },

  reset(): void {
    this.stopAutoCapture()
    onCaptureCallback = null
    cachedScreenshotData = null
    cachedScreenshotTimestamp = 0
  },
}
