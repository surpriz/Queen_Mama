type ScreenCaptureCallback = (imageData: string) => void

let captureInterval: ReturnType<typeof setInterval> | null = null
let isCapturing = false
let lastHash: string | null = null
let onCaptureCallback: ScreenCaptureCallback | null = null

async function hashImage(dataUrl: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(dataUrl)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function captureAndProcess(): Promise<string | null> {
  try {
    // Request screen capture via IPC to main process
    const dataUrl = await window.electronAPI?.screen.capture()
    if (!dataUrl) return null

    // Deduplicate using hash
    const hash = await hashImage(dataUrl)
    if (hash === lastHash) return null
    lastHash = hash

    // Resize to max 1024x576 and compress as JPEG 50%
    const resized = await resizeImage(dataUrl, 1024, 576, 0.5)
    return resized
  } catch (error) {
    console.error('[ScreenCapture] Capture failed:', error)
    return null
  }
}

function resizeImage(
  dataUrl: string,
  maxWidth: number,
  maxHeight: number,
  quality: number,
): Promise<string> {
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
      resolve(canvas.toDataURL('image/jpeg', quality))
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
  },

  reset(): void {
    this.stopAutoCapture()
    onCaptureCallback = null
  },
}
