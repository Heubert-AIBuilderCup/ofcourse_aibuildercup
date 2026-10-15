/**
 * A map of fixed size that forgets the entry used least recently once it is full. A Map keeps
 * insertion order, so a read moves its key to the end and the first key is always the oldest.
 */
export class Lru<V> {
  private readonly entries = new Map<string, V>()

  constructor(private readonly max: number) {}

  get size(): number {
    return this.entries.size
  }

  get(key: string): V | undefined {
    const value = this.entries.get(key)
    if (value === undefined) return undefined
    this.entries.delete(key)
    this.entries.set(key, value)
    return value
  }

  set(key: string, value: V): void {
    this.entries.delete(key)
    this.entries.set(key, value)
    if (this.entries.size > this.max) {
      const oldest = this.entries.keys().next().value
      if (oldest !== undefined) this.entries.delete(oldest)
    }
  }
}
