interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    // A cleanup timer must never keep a process alive (tests that import the cache would not exit).
    this.cleanupInterval.unref();
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  // For debugging/monitoring
  size(): number {
    return this.cache.size;
  }

  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance for F1 API data
export const f1Cache = new SimpleCache();

// TTL constants
export const CACHE_TTL = {
  COMPLETED_SESSION: 24 * 60 * 60 * 1000,  // 24 hours for completed sessions
  RECENT_SESSION: 15 * 60 * 1000,           // 15 minutes for recent data
  DRIVER_STANDINGS: 60 * 60 * 1000,         // 1 hour for standings
  RACE_SCHEDULE: 6 * 60 * 60 * 1000,        // 6 hours for schedule
};

// Helper to determine appropriate TTL based on race date
export function getTTLForSession(raceDate: Date | string): number {
  const date = typeof raceDate === 'string' ? new Date(raceDate) : raceDate;
  const now = new Date();
  const hoursSinceRace = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  // If race was more than 48 hours ago, use long cache
  if (hoursSinceRace > 48) {
    return CACHE_TTL.COMPLETED_SESSION;
  }

  // If race was within last 48 hours, use shorter cache (results may update)
  if (hoursSinceRace > 0) {
    return CACHE_TTL.RECENT_SESSION;
  }

  // Future race - don't cache long
  return CACHE_TTL.RECENT_SESSION;
}
