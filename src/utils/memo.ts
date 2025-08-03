type MemoizedFunction<Fn extends (...args: any[]) => any> = Fn & {
  clearMemoCache: () => void
}

const baseGetKey = (...params: any[]) => JSON.stringify(params)

export function memo<Fn extends (...args: any[]) => any>(fn: Fn, getKey: (...params: Parameters<Fn>) => string = baseGetKey): MemoizedFunction<Fn> {
  const cache = new Map<string, ReturnType<Fn>>()

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
  }

  return Object.assign(memoizedFunction, {
    clearMemoCache,
  }) as MemoizedFunction<Fn>
};
