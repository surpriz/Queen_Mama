import { desktopCapturer, type DesktopCapturerSource } from 'electron'

export interface ScreenSource {
  id: string
  name: string
  thumbnailDataUrl: string
}

export async function getScreenSources(): Promise<ScreenSource[]> {
  try {
    const sources: DesktopCapturerSource[] = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
    })

    return sources
      .filter((s) => !s.name.toLowerCase().includes('queen mama'))
      .map((source) => ({
        id: source.id,
        name: source.name,
        thumbnailDataUrl: source.thumbnail.toDataURL(),
      }))
  } catch (error) {
    console.error('[ScreenCapture] Failed to get sources:', error)
    return []
  }
}

export async function captureScreen(): Promise<string | null> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    })

    if (sources.length === 0) return null

    // Use primary screen (first source)
    const primary = sources[0]
    return primary.thumbnail.toDataURL('image/jpeg', 0.5)
  } catch (error) {
    console.error('[ScreenCapture] Failed to capture screen:', error)
    return null
  }
}
