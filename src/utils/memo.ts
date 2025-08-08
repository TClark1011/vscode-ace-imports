type MemoizedFunction<Fn extends (...args: any[]) => any> = Fn & {
  clearMemoCache: (key?: string) => void
}

const baseGetKey = (...params: any[]) => JSON.stringify(params)

interface MemoOptions<Fn extends (...args: any[]) => any> {
  /** Custom key composer function used for searching the cache. */
  getKey?: (...params: Parameters<Fn>) => string
  /**
   * Other memo'd dependencies that this function depends on. When this function's cache
   * is cleared, these dependencies will also ahve their cache cleared.
   */
  dependencies?: MemoizedFunction<any>[]
}

export function memo<Fn extends (...args: any[]) => any>(fn: Fn, options: MemoOptions<Fn> = {}): MemoizedFunction<Fn> {
  const cache = new Map<string, ReturnType<Fn>>()
  const { getKey = baseGetKey, dependencies = [] } = options

  const memoizedFunction = (...args: Parameters<Fn>): ReturnType<Fn> => {
    const key = getKey(...args)
    if (cache.has(key)) {
      return cache.get(key)!
    }
    const result = fn(...args)
    cache.set(key, result)
    return result
  }

  const clearMemoCache = () => {
    cache.clear()
    dependencies.forEach(dep => dep.clearMemoCache())
  }

  return Object.assign(memoizedFunction, {
    clearMemoCache,
  }) as MemoizedFunction<Fn>
};
