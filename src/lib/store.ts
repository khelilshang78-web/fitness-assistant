import { useCallback, useState } from 'react'

// 简单的 localStorage 持久化 hook，写入时同时广播自定义事件供跨标签同步
export function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw !== null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  const set = useCallback(
    (v: T | ((p: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v
        try {
          if (next === null || next === undefined) localStorage.removeItem(key)
          else localStorage.setItem(key, JSON.stringify(next))
        } catch {
          // ignore quota errors
        }
        window.dispatchEvent(new CustomEvent('jzzj-storage', { detail: { key } }))
        return next
      })
    },
    [key],
  )

  return [value, set]
}

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
