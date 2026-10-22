import { describe, expect, it } from 'vitest'
import { RECOVERY_KEY_PREFIX, STORAGE_KEY, emptyData, loadData, saveData, type KeyValueStore } from '../src/services/storage'
import { SCHEMA_VERSION } from '../src/types/reminder'
import { makeReminder } from './fixtures'

class MemoryStore implements KeyValueStore {
  items = new Map<string, string>()
  getItem(key: string) {
    return this.items.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.items.set(key, value)
  }
  recoveryKeys() {
    return [...this.items.keys()].filter((k) => k.startsWith(RECOVERY_KEY_PREFIX))
  }
}

describe('storage', () => {
  it('returns empty data on first run', () => {
    const result = loadData(new MemoryStore())
    expect(result.status).toBe('ok')
    expect(result.data).toEqual(emptyData())
  })

  it('round-trips saved data', () => {
    const store = new MemoryStore()
    const data = { ...emptyData(), reminders: [makeReminder({ amount: 12.5, currency: 'GBP' })], preferences: { currency: 'GBP' } }
    expect(saveData(data, store)).toBe(true)
    const result = loadData(store)
    expect(result.status).toBe('ok')
    expect(result.data).toEqual(data)
  })

  it('stores a schema version', () => {
    const store = new MemoryStore()
    saveData(emptyData(), store)
    expect(JSON.parse(store.getItem(STORAGE_KEY)!).version).toBe(SCHEMA_VERSION)
  })

  it('recovers from invalid JSON and keeps a copy of the raw data', () => {
    const store = new MemoryStore()
    store.setItem(STORAGE_KEY, '{not json')
    const result = loadData(store)
    expect(result.status).toBe('corrupted')
    expect(result.data.reminders).toEqual([])
    expect(store.recoveryKeys()).toHaveLength(1)
    expect(store.getItem(store.recoveryKeys()[0]!)).toBe('{not json')
  })

  it('treats an unknown schema version as corrupted', () => {
    const store = new MemoryStore()
    store.setItem(STORAGE_KEY, JSON.stringify({ version: 99, reminders: [] }))
    expect(loadData(store).status).toBe('corrupted')
  })

  it('skips damaged reminders but keeps the valid ones', () => {
    const store = new MemoryStore()
    const good = makeReminder()
    store.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: SCHEMA_VERSION, reminders: [good, { id: 'bad' }, good], preferences: {} }),
    )
    const result = loadData(store)
    expect(result.status).toBe('partial')
    expect(result.skipped).toBe(2) // the bad one and the duplicate id
    expect(result.data.reminders).toEqual([good])
    expect(store.recoveryKeys()).toHaveLength(1)
  })

  it('falls back to default preferences when they are invalid', () => {
    const store = new MemoryStore()
    store.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, reminders: [], preferences: { currency: 'nope' } }))
    expect(loadData(store).data.preferences.currency).toBe('USD')
  })

  it('reports unavailable storage', () => {
    expect(loadData(null).status).toBe('unavailable')
    const throwing: KeyValueStore = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(loadData(throwing).status).toBe('unavailable')
    expect(saveData(emptyData(), throwing)).toBe(false)
  })
})
