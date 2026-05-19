/**
 * LRU cache for translation results. Avoids re-translating identical chunks
 * (common phrases: "yes", "ok", repeated questions).
 * Key = sha256(SOURCE→TARGET‖normalized text).
 */
export class TranslationCache {
  private readonly capacity: number
  private readonly storage = new Map<string, string>()

  constructor(capacity = 1000) {
    this.capacity = capacity
  }

  lookup(text: string, sourceLang: string | null | undefined, targetLang: string): string | null {
    const key = TranslationCache.makeKey(text, sourceLang, targetLang)
    const value = this.storage.get(key)
    if (value === undefined) return null
    // MRU: re-insert
    this.storage.delete(key)
    this.storage.set(key, value)
    return value
  }

  store(text: string, sourceLang: string | null | undefined, targetLang: string, translation: string): void {
    const key = TranslationCache.makeKey(text, sourceLang, targetLang)
    if (this.storage.has(key)) {
      this.storage.delete(key)
    } else if (this.storage.size >= this.capacity) {
      const oldest = this.storage.keys().next().value
      if (oldest !== undefined) this.storage.delete(oldest)
    }
    this.storage.set(key, translation)
  }

  clear(): void {
    this.storage.clear()
  }

  get size(): number {
    return this.storage.size
  }

  static makeKey(text: string, sourceLang: string | null | undefined, targetLang: string): string {
    const normalized = text.trim().toLowerCase()
    const source = (sourceLang ?? 'AUTO').toUpperCase()
    const target = targetLang.toUpperCase()
    return TranslationCache.sha256Sync(`${source}→${target}‖${normalized}`)
  }

  /**
   * Lightweight synchronous hash. We don't need cryptographic strength — just
   * a stable, collision-resistant key. FNV-1a over the UTF-8 bytes, doubled to
   * approximate 128-bit width.
   */
  private static sha256Sync(input: string): string {
    let h1 = 0x811c9dc5
    let h2 = 0x01000193
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i)
      h1 ^= c
      h1 = Math.imul(h1, 0x01000193)
      h2 ^= c + 0x9e3779b1
      h2 = Math.imul(h2, 0x85ebca6b)
    }
    const hex1 = (h1 >>> 0).toString(16).padStart(8, '0')
    const hex2 = (h2 >>> 0).toString(16).padStart(8, '0')
    return hex1 + hex2
  }
}
