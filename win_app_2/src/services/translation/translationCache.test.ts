import { describe, it, expect, beforeEach } from 'vitest'
import { TranslationCache } from './translationCache'

describe('TranslationCache', () => {
  let cache: TranslationCache

  beforeEach(() => {
    cache = new TranslationCache(1000)
  })

  describe('lookup / store', () => {
    it('returns null on a miss', () => {
      expect(cache.lookup('hello', 'EN-US', 'FR')).toBeNull()
    })

    it('returns the stored value on a hit', () => {
      cache.store('hello', 'EN-US', 'FR', 'bonjour')
      expect(cache.lookup('hello', 'EN-US', 'FR')).toBe('bonjour')
    })

    it('overwrites an existing entry without growing size', () => {
      cache.store('hello', 'EN-US', 'FR', 'bonjour')
      cache.store('hello', 'EN-US', 'FR', 'salut')
      expect(cache.lookup('hello', 'EN-US', 'FR')).toBe('salut')
      expect(cache.size).toBe(1)
    })
  })

  describe('normalization', () => {
    it('matches across case and surrounding whitespace', () => {
      cache.store('yes', 'EN-US', 'FR', 'oui')
      expect(cache.lookup('  YES ', 'EN-US', 'FR')).toBe('oui')
    })

    it('treats null and "auto" source as the same key', () => {
      cache.store('hello', null, 'FR', 'bonjour')
      expect(cache.lookup('hello', 'auto', 'FR')).toBe('bonjour')
      expect(cache.lookup('hello', 'AUTO', 'FR')).toBe('bonjour')
    })

    it('is case-insensitive on the target lang code', () => {
      cache.store('hello', null, 'fr', 'bonjour')
      expect(cache.lookup('hello', null, 'FR')).toBe('bonjour')
    })
  })

  describe('key uniqueness', () => {
    it('keys vary by target language', () => {
      cache.store('hello', 'EN-US', 'FR', 'bonjour')
      cache.store('hello', 'EN-US', 'DE', 'hallo')
      expect(cache.lookup('hello', 'EN-US', 'FR')).toBe('bonjour')
      expect(cache.lookup('hello', 'EN-US', 'DE')).toBe('hallo')
      expect(cache.size).toBe(2)
    })

    it('keys vary by source language', () => {
      cache.store('si', 'ES', 'EN-US', 'yes')
      cache.store('si', 'IT', 'EN-US', 'yourself')
      expect(cache.lookup('si', 'ES', 'EN-US')).toBe('yes')
      expect(cache.lookup('si', 'IT', 'EN-US')).toBe('yourself')
    })

    it('makeKey is stable and distinct per (source, target, text)', () => {
      const a = TranslationCache.makeKey('hi', null, 'FR')
      const b = TranslationCache.makeKey('hi', null, 'FR')
      const c = TranslationCache.makeKey('hi', null, 'DE')
      expect(a).toBe(b)
      expect(a).not.toBe(c)
    })
  })

  describe('LRU eviction', () => {
    it('evicts the oldest entry past capacity', () => {
      const lru = new TranslationCache(2)
      lru.store('a', null, 'FR', '1')
      lru.store('b', null, 'FR', '2')
      lru.store('c', null, 'FR', '3') // evicts 'a'

      expect(lru.lookup('a', null, 'FR')).toBeNull()
      expect(lru.lookup('b', null, 'FR')).toBe('2')
      expect(lru.lookup('c', null, 'FR')).toBe('3')
      expect(lru.size).toBe(2)
    })

    it('a lookup promotes an entry to MRU, sparing it from eviction', () => {
      const lru = new TranslationCache(2)
      lru.store('a', null, 'FR', '1')
      lru.store('b', null, 'FR', '2')
      lru.lookup('a', null, 'FR') // promote 'a' → 'b' is now oldest
      lru.store('c', null, 'FR', '3') // evicts 'b'

      expect(lru.lookup('a', null, 'FR')).toBe('1')
      expect(lru.lookup('b', null, 'FR')).toBeNull()
      expect(lru.lookup('c', null, 'FR')).toBe('3')
    })

    it('re-storing an existing key does not evict another entry', () => {
      const lru = new TranslationCache(2)
      lru.store('a', null, 'FR', '1')
      lru.store('b', null, 'FR', '2')
      lru.store('a', null, 'FR', '1bis') // update, not insert
      expect(lru.size).toBe(2)
      expect(lru.lookup('a', null, 'FR')).toBe('1bis')
      expect(lru.lookup('b', null, 'FR')).toBe('2')
    })
  })

  describe('size / clear', () => {
    it('tracks size and clears', () => {
      cache.store('a', null, 'FR', '1')
      cache.store('b', null, 'FR', '2')
      expect(cache.size).toBe(2)
      cache.clear()
      expect(cache.size).toBe(0)
      expect(cache.lookup('a', null, 'FR')).toBeNull()
    })
  })
})
